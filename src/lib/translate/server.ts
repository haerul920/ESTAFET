import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfig } from "@/lib/llm";
import { callAnthropic, callGemini } from "@/lib/llm/providers";
import { allow } from "@/lib/rate-limit";
import { errorFields, log } from "@/lib/log";
import type { TeaserItem, TeaserProject } from "@/lib/db/types";
import { getTeaserItemsFor, inBatches } from "@/lib/db/public";
import { checkAnswer, fingerprint, publicText, translationPrompt, type Lang, type Translation } from "./core";

const TIMEOUT_MS = 20_000;
const dailyCap = () => Math.max(0, Number(process.env.TRANSLATION_DAILY_CAP ?? 500) || 0);

interface Row {
  project_id: string;
  source_hash: string;
  content: Translation;
  same_language: boolean;
}

/** What is already stored. `undefined` = nothing usable yet; `null` = the text needs no translation. */
function fromRow(row: Row | undefined, hash: string): Translation | null | undefined {
  if (!row || row.source_hash !== hash) return undefined;
  return row.same_language ? null : row.content;
}

async function readRows(ids: string[], lang: Lang): Promise<Map<string, Row> | null> {
  const db = createAdminClient();
  const answers = await Promise.all(
    inBatches(ids).map((batch) =>
      db
        .from("project_translations")
        .select("project_id, source_hash, content, same_language")
        .eq("lang", lang)
        .in("project_id", batch),
    ),
  );
  // A database without the table yet, or an outage: readers simply see the original text. Null also stops new
  // translations being asked for, because they could not be stored and would be paid for again on every view.
  const failed = answers.find((a) => a.error);
  if (failed?.error) {
    log.warn("translation.read_failed", errorFields(failed.error));
    return null;
  }
  return new Map(answers.flatMap((a) => (a.data ?? []) as Row[]).map((r) => [r.project_id, r]));
}

/**
 * Asks the AI for one translation and stores it. Returns null whenever there is nothing to show: mock mode (a made-up
 * translation would be dishonest), a limit reached, a failed or implausible answer, or text already in that language.
 */
async function create(
  projectId: string,
  source: ReturnType<typeof publicText>,
  lang: Lang,
): Promise<Translation | null> {
  const config = getConfig();
  if (config.mode !== "live") return null;
  // A few tries per project and hour, and one daily cap for the whole site, keep the cost bounded.
  if (!(await allow({ scope: "translate", identity: `${projectId}:${lang}`, max: 4, windowSeconds: 3600 })))
    return null;
  if (!(await allow({ scope: "translate-day", identity: "all", max: dailyCap(), windowSeconds: 86_400 }))) return null;
  try {
    const call = config.provider === "anthropic" ? callAnthropic : callGemini;
    const raw = await call(
      config.model,
      JSON.stringify(source),
      AbortSignal.timeout(TIMEOUT_MS),
      lang,
      translationPrompt(lang),
    );
    const result = checkAnswer(source, raw);
    if (!result) {
      log.warn("translation.rejected", { projectId, lang });
      return null;
    }
    const { error } = await createAdminClient()
      .from("project_translations")
      .upsert({
        project_id: projectId,
        lang,
        source_hash: fingerprint(source),
        content: result.text,
        same_language: result.same,
        provider: config.provider,
        model: config.model,
      });
    if (error) log.warn("translation.store_failed", { projectId, lang, ...errorFields(error) });
    return result.same ? null : result.text;
  } catch (e) {
    log.warn("translation.failed", { projectId, lang, ...errorFields(e) });
    return null;
  }
}

/** The translation of one public project into the reader's language, or null to show the original. */
export async function translationFor(
  project: TeaserProject,
  items: TeaserItem[],
  lang: Lang,
): Promise<Translation | null> {
  const source = publicText(project, items);
  const rows = await readRows([project.id], lang);
  if (!rows) return null;
  const stored = fromRow(rows.get(project.id), fingerprint(source));
  return stored !== undefined ? stored : create(project.id, source, lang);
}

/** Missing translations a list waits for, and for how long. The rest are made after the page has been sent. */
const WAIT_FOR = 6;
const WAIT_MS = 12_000;

/**
 * Translations for a list of project cards. `later` runs work after the response (Next.js `after`).
 */
export async function translationsForList(
  projects: TeaserProject[],
  lang: Lang,
  later: (work: () => Promise<unknown>) => void,
): Promise<Map<string, Translation>> {
  const out = new Map<string, Translation>();
  if (projects.length === 0) return out;
  const ids = projects.map((p) => p.id);
  const [rows, items] = await Promise.all([readRows(ids, lang), getTeaserItemsFor(ids)]);
  if (!rows) return out;
  const missing: { id: string; source: ReturnType<typeof publicText> }[] = [];
  projects.forEach((p) => {
    const source = publicText(p, items.get(p.id) ?? []);
    const stored = fromRow(rows.get(p.id), fingerprint(source));
    if (stored === undefined) missing.push({ id: p.id, source });
    else if (stored) out.set(p.id, stored);
  });
  if (missing.length === 0 || getConfig().mode !== "live") return out;

  const now = missing.slice(0, WAIT_FOR).map(async (m) => {
    const text = await create(m.id, m.source, lang);
    if (text) out.set(m.id, text);
  });
  const finished = Promise.all(now);
  await Promise.race([finished, new Promise((resolve) => setTimeout(resolve, WAIT_MS))]);
  later(() => finished);
  const rest = missing.slice(WAIT_FOR, WAIT_FOR * 3);
  if (rest.length) later(() => Promise.all(rest.map((m) => create(m.id, m.source, lang))));
  return new Map(out);
}

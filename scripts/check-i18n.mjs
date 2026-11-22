// i18n check (CLAUDE.md 14.7). Fails when:
//   1. a key exists in messages/id.json but not in messages/en.json, or the other way round, or placeholders differ;
//   2. code uses a key that does not exist;
//   3. a key exists but nothing uses it;
//   4. a component under src/ has a hard-coded user-facing string (the admin area is exempt until phase R6).
// Run: node scripts/check-i18n.mjs        (also part of CI)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const id = JSON.parse(readFileSync(join(ROOT, "messages/id.json"), "utf8"));
const en = JSON.parse(readFileSync(join(ROOT, "messages/en.json"), "utf8"));

const flat = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
const idMap = new Map(flat(id));
const enMap = new Map(flat(en));

/** Top-level ICU argument names. Text inside plural and select branches is not scanned. */
function placeholders(s) {
  const names = new Set();
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") {
      if (depth === 0) {
        const m = /^\{\s*(\w+)/.exec(s.slice(i));
        if (m) names.add(m[1]);
      }
      depth++;
    } else if (s[i] === "}") depth--;
  }
  return [...names].sort().join(",");
}

const errors = [];
const fail = (m) => errors.push(m);

// 1. parity
for (const k of idMap.keys()) if (!enMap.has(k)) fail(`missing in en.json: ${k}`);
for (const k of enMap.keys()) if (!idMap.has(k)) fail(`missing in id.json: ${k}`);
for (const [k, v] of idMap) {
  if (enMap.has(k) && placeholders(String(v)) !== placeholders(String(enMap.get(k))))
    fail(`placeholders differ for ${k}`);
  if (String(v).trim() === "") fail(`empty id message: ${k}`);
}

// source files
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const files = walk(join(ROOT, "src"));

// Translators that are passed in as parameters rather than created in the file.
const FILE_NS = {
  "src/lib/db/dashboard.ts": { t: "dashboard" },
  "src/lib/lineage.ts": { t: "lineage" },
  "src/lib/agreement/terms.ts": { t: "agreement" },
  "src/lib/errors.ts": { t: "errors" },
};
// Keys that are built from data at run time (enum values, SQL hints), so a static scan cannot see them used.
const DYNAMIC_PREFIXES = [
  "labels.",
  "email.",
  "errors.hints.",
  "lineage.events.",
  "report.r.",
  "auth.demo",
  "legal.",
  "admin.status.",
  "admin.shell.nav",
  "admin.shell.group",
  "admin.reasons.",
  "admin.kinds.",
  "admin.modes.",
  "admin.actionsName.",
  "admin.targets.",
  "admin.errors.",
  "admin.reports.tpl.",
  "admin.settings.row.source",
  "admin.policies.terms",
  "admin.policies.privacy",
  "decision.status",
  "decision.action.",
  "myReports.status.",
  "myReports.explain.",
  "report.d.",
  "account.delete.l",
  "wizard.step",
  "board.f",
  "board.st",
  "access.open",
  "access.byRequest",
  "access.paused",
  "wizard.limit",
  "wizard.effect",
  "settings.req.",
  "settings.pub.",
  "review.tpl",
  "workspace.progressNone",
  "workspace.progressDoing",
  "workspace.progressDone",
];
// Single keys picked by a variable (for example t(link.key) or ag(k)).
const DYNAMIC_KEYS = [
  "nav.explore",
  "nav.dashboard",
  "lang.id",
  "lang.en",
  "agreement.t1",
  "agreement.t2",
  "agreement.t3",
  "agreement.t4",
];

const used = new Set();
const usedPrefixes = new Set();
const fullKey = (ns, key) => (ns ? `${ns}.${key}` : key);

function markIn(nsList, key, file, strict) {
  if (key.includes("${")) {
    for (const ns of nsList) usedPrefixes.add(fullKey(ns, key.split("${")[0]));
    return;
  }
  const hit = nsList.map((ns) => fullKey(ns, key)).filter((k) => idMap.has(k));
  if (hit.length) for (const k of hit) used.add(k);
  else if (strict)
    fail(
      `${relative(ROOT, file)}: unknown message key "${fullKey(nsList[0], key)}"${nsList.length > 1 ? ` (also tried ${nsList.slice(1).join(", ")})` : ""}`,
    );
}

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  // A name can be declared in several scopes of one file (for example `t` in generateMetadata and in the page),
  // so each name maps to every namespace declared for it. A key is valid when it exists in any of them.
  const vars = {};
  const addVar = (name, ns) => (vars[name] ??= new Set()).add(ns);
  for (const [n, ns] of Object.entries(FILE_NS[rel] ?? {})) addVar(n, ns);

  for (const m of src.matchAll(
    /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([\w.]+)"\s*\)/g,
  ))
    addVar(m[1], m[2]);
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*await\s+getTranslations\(\{[^}]*namespace:\s*"([\w.]+)"[^}]*\}\)/g))
    addVar(m[1], m[2]);
  for (const m of src.matchAll(/const\s+\[([^\]]+)\]\s*=\s*(?:\()?await\s+Promise\.all\(\[([\s\S]*?)\]\)/g)) {
    const names = m[1].split(",").map((x) => x.trim());
    const items = [];
    let depth = 0;
    let cur = "";
    for (const ch of m[2]) {
      if ("([{".includes(ch)) depth++;
      if (")]}".includes(ch)) depth--;
      if (ch === "," && depth === 0) {
        items.push(cur);
        cur = "";
      } else cur += ch;
    }
    items.push(cur);
    items.forEach((item, i) => {
      const a = /(?:useTranslations|getTranslations)\(\s*"([\w.]+)"\s*\)/.exec(item);
      const b = /getTranslations\(\{[^}]*namespace:\s*"([\w.]+)"/.exec(item);
      const ns = a?.[1] ?? b?.[1];
      if (ns && names[i]) addVar(names[i], ns);
    });
  }
  // The server actions keep their translators in `t.v`, `t.a` and `t.e`.
  if (/async function tr\(\)/.test(src)) {
    for (const m of src.matchAll(/getTranslations\("(\w+)"\)/g)) {
      const letter = { validation: "v", actions: "a", errors: "e" }[m[1]];
      if (letter) addVar(`t.${letter}`, m[1]);
    }
  }
  // (await getTranslations({ locale, namespace: "x" }))("key")
  for (const m of src.matchAll(/getTranslations\(\{[^}]*namespace:\s*"([\w.]+)"[^}]*\}\)\)\(\s*(["`])([^"`]+)/g))
    markIn([m[1]], m[3], file, true);

  for (const [name, nsSet] of Object.entries(vars)) {
    const escaped = name.replace(/\./g, "\\.");
    const re = new RegExp(`(?<![\\w.])${escaped}(?:\\.rich|\\.has)?\\(`, "g");
    for (const m of src.matchAll(re)) {
      // The call arguments up to the matching parenthesis.
      let depth = 1;
      let j = m.index + m[0].length;
      const start = j;
      while (j < src.length && depth > 0) {
        if (src[j] === "(") depth++;
        else if (src[j] === ")") depth--;
        j++;
      }
      const args = src.slice(start, j - 1);
      const lits = [...args.matchAll(/(["`])([\w.${}]+)\1/g)].map((x) => x[2]);
      if (lits.length === 0) continue;
      // The first literal must be a real key. Further literals (ternary branches) only count when they exist.
      const first = /^\s*(["`])([^"`]+)\1/.exec(args);
      if (first) markIn([...nsSet], first[2], file, true);
      for (const lit of lits) if (!first || lit !== first[2]) markIn([...nsSet], lit, file, false);
    }
  }
}

// 3. unused
for (const k of idMap.keys()) {
  if (used.has(k)) continue;
  if ([...usedPrefixes].some((p) => k.startsWith(p))) continue;
  if (DYNAMIC_PREFIXES.some((p) => k.startsWith(p)) || DYNAMIC_KEYS.includes(k)) continue;
  fail(`unused message key: ${k}`);
}

// 4. hard-coded strings in components
const EXEMPT = [/^src\/app\/api\//];
const ALLOW_WORDS = new Set([
  "ESTAFET",
  "STACK",
  "PDF",
  "Markdown",
  "ZIP",
  "ID",
  "EN",
  "Supabase",
  "Beban",
  "Server",
  "Promise",
  "DemoPass2026",
  "env",
]);
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (!/\.tsx$/.test(rel) || EXEMPT.some((r) => r.test(rel))) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const l = line.trim();
    if (l.startsWith("//") || l.startsWith("*") || l.startsWith("/*") || l.startsWith("import ")) return;
    const text = [...l.matchAll(/>\s*([^<>{}\n]*[A-Za-z]{3,}[^<>{}\n]*)\s*</g)]
      .map((m) => m[1].trim())
      .filter((s) => !/^(=>|\)|&&|\|\|)/.test(s) && !/[;=?]/.test(s));
    const attrs = [...l.matchAll(/\b(placeholder|aria-label|title|alt)="([^"{}]{3,})"/g)].map((m) => m[2]);
    for (const s of [...text, ...attrs]) {
      const words = s.split(/\s+/).filter((w) => /[A-Za-z]{3,}/.test(w) && !ALLOW_WORDS.has(w.replace(/[^\w]/g, "")));
      if (words.length) fail(`${rel}:${i + 1}: hard-coded text "${s.slice(0, 60)}"`);
    }
  });
}

if (errors.length) {
  console.error(`i18n check failed (${errors.length}):`);
  for (const e of errors.slice(0, 200)) console.error(" - " + e);
  if (errors.length > 200) console.error(` ... and ${errors.length - 200} more`);
  process.exit(1);
}
console.log(
  `i18n check passed: ${idMap.size} keys, both languages, no missing or unused keys, no hard-coded component text.`,
);

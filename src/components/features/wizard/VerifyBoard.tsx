"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Check, FlaskConical, Pencil, Plus, Sparkles, Trash2, Undo2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge, EvidenceChip } from "@/components/ui/Badge";
import { FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { AnimatedBar } from "@/components/ui/motion";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { createClient } from "@/lib/supabase/client";
import { applyDraftSummary } from "@/app/actions/projects";
import { useLabels } from "@/lib/use-labels";
import { cn } from "@/lib/cn";
import type { DraftItem, ItemKind, ReviewStatus } from "@/lib/db/types";
import type { SourceView, PublishChecklist } from "@/lib/db/owner";

const FILTERS = [
  { id: "all", key: "fAll" },
  { id: "objective", key: "fObjectives" },
  { id: "completed", key: "fCompleted" },
  { id: "next_task", key: "fNext" },
  { id: "lesson", key: "fLessons" },
] as const;

const STATUS = {
  pending: { key: "stPending", tone: "warn" as const },
  kept: { key: "stKept", tone: "ok" as const },
  removed: { key: "stRemoved", tone: "neutral" as const },
} as const;

export function VerifyBoard({
  projectId,
  initialItems,
  sources,
  checklist,
  mockMode,
  summary,
  draftSummary,
}: {
  projectId: string;
  initialItems: DraftItem[];
  sources: Record<string, SourceView>;
  checklist: PublishChecklist;
  mockMode: boolean;
  summary: string;
  draftSummary: string | null;
}) {
  const t = useTranslations("board");
  const L = useLabels();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<string | null>(
    initialItems.find((i) => i.review_status === "pending")?.id ?? initialItems[0]?.id ?? null,
  );
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", description: "" });
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [, startTransition] = useTransition();
  const [summaryUsed, setSummaryUsed] = useState(false);

  const total = items.length;
  const reviewed = items.filter((i) => i.review_status !== "pending").length;
  const keptCount = items.filter((i) => i.review_status === "kept").length;
  const allReviewed = total > 0 && reviewed === total && keptCount > 0;
  const ready = allReviewed && checklist.advisor.done && checklist.team.done;
  const advisorOk = checklist.advisor.done;
  const visible = items.filter((i) => filter === "all" || i.kind === filter);
  const sel = items.find((i) => i.id === selected) ?? null;
  const source = sel ? sources[sel.id] : null;

  async function persist(id: string, patch: Partial<DraftItem>, rollback: DraftItem) {
    const { error: err } = await supabase.from("draft_items").update(patch).eq("id", id);
    if (err) {
      setError(t("saveFailed"));
      setItems((cur) => cur.map((i) => (i.id === id ? rollback : i)));
    } else {
      setError("");
      startTransition(() => router.refresh());
    }
  }

  function setReview(item: DraftItem, value: ReviewStatus) {
    const next: ReviewStatus = item.review_status === value ? "pending" : value;
    setSelected(item.id);
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, review_status: next } : i)));
    void persist(item.id, { review_status: next }, item);
  }

  function startEdit(item: DraftItem) {
    setEditing(item.id);
    setSelected(item.id);
    setDraft({ title: item.title, description: item.description });
  }

  function saveEdit(item: DraftItem) {
    const title = draft.title.trim();
    if (title.length < 3) {
      setError("A title needs at least 3 characters.");
      return;
    }
    const patch = { title, description: draft.description.trim() };
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    setEditing(null);
    void persist(item.id, patch, item);
  }

  const footnote = ready
    ? t("footReady")
    : total === 0
      ? t("footNone")
      : !allReviewed
        ? reviewed === total && keptCount === 0
          ? t("footKeepOne")
          : t("footRemaining", { count: total - reviewed })
        : !checklist.advisor.done
          ? t("footAdvisor")
          : t("footTeam");

  return (
    <LayoutGroup>
      {mockMode ? (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-[18px] bg-warn-bg p-4 text-warn-ink">
          <FlaskConical size={20} className="mt-0.5 flex-none" aria-hidden="true" />
          <span>
            <strong>{t("mockBold")}</strong> {t("mockText")}
          </span>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-[280px] flex-[1_1_440px]">
          <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">{t("title")}</h1>
          <p className="m-0 text-text-2">{t("intro")}</p>
        </div>
        <div className="flex-[0_1_280px]">
          <div className="mb-1.5 text-sm" aria-live="polite">
            <strong>{t("reviewedCount", { reviewed, total })}</strong>
          </div>
          <AnimatedBar pct={total ? (reviewed / total) * 100 : 0} track="#DDE1E5" label={t("barLabel")} />
        </div>
      </div>

      {draftSummary && !summaryUsed && draftSummary.trim() !== summary.trim() ? (
        <Card tone="blue" className="mb-6">
          <h2 className="mb-1 mt-0 flex items-center gap-2 text-base">
            <Sparkles size={16} aria-hidden="true" /> {t("summaryTitle")}
          </h2>
          <p className="mb-3 mt-0 text-[15px] text-text-3">{draftSummary}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="md"
              variant="outlineBlue"
              onClick={() =>
                startTransition(async () => {
                  const r = await applyDraftSummary(projectId, draftSummary);
                  if (r.error) setError(r.error);
                  else setSummaryUsed(true);
                })
              }
            >
              {t("useSummary")}
            </Button>
            <Button size="md" variant="ghost" onClick={() => setSummaryUsed(true)}>
              {t("keepSummary")}
            </Button>
          </div>
        </Card>
      ) : null}

      <SegmentedTabs
        label={t("filterLabel")}
        value={filter}
        onChange={setFilter}
        tabs={FILTERS.map((f) => ({ id: f.id, label: t(f.key), count: undefined }))}
      >
        {error ? (
          <div className="mb-4">
            <FormMessage tone="error">{error}</FormMessage>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start gap-6">
          <section aria-label={t("itemsLabel")} className="flex min-w-0 flex-[1_1_560px] flex-col gap-3">
            {visible.length === 0 ? (
              <Card tone="dashed" className="text-center text-text-2">
                {total === 0 ? t("none") : t("noneGroup")}
              </Card>
            ) : null}
            <AnimatePresence initial={false}>
              {visible.map((it) => {
                const st = STATUS[it.review_status];
                const isSel = selected === it.id;
                const src = sources[it.id];
                const evDetail = src && src.file ? `${src.file}, ${src.pageLabel}` : undefined;
                return (
                  <motion.div
                    key={it.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: it.review_status === "removed" ? 0.6 : 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "flex flex-col gap-2.5 rounded-3xl bg-white p-4",
                      isSel ? "border-2 border-blue" : "border border-line",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold text-blue-dark">
                        {L.itemKind[it.kind as ItemKind]}
                        {it.kind === "lesson" && it.lesson_type ? ` · ${L.lesson[it.lesson_type]}` : ""}
                        {it.origin === "creator" ? t("addedByYou") : ""}
                      </span>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={it.review_status}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Badge tone={st.tone}>{t(st.key)}</Badge>
                        </motion.span>
                      </AnimatePresence>
                    </div>

                    {editing === it.id ? (
                      <div className="flex flex-col gap-3">
                        <TextField
                          label={t("fieldTitle")}
                          value={draft.title}
                          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        />
                        {it.kind !== "lesson" ? (
                          <TextArea
                            label={t("fieldDescription")}
                            rows={2}
                            value={draft.description}
                            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                          />
                        ) : null}
                        <div className="flex gap-2">
                          <Button size="md" onClick={() => saveEdit(it)}>
                            {t("save")}
                          </Button>
                          <Button size="md" variant="outline" onClick={() => setEditing(null)}>
                            {t("cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelected(it.id)}
                          aria-label={t("showSource", { title: it.title })}
                          className={cn(
                            "cursor-pointer bg-transparent p-0 text-left text-[17px] font-semibold text-ink",
                            it.review_status === "removed" && "line-through",
                          )}
                        >
                          {it.title}
                        </button>
                        {it.description ? <span className="text-[15px] text-text-2">{it.description}</span> : null}
                        {it.origin === "creator" ? (
                          <Badge tone="info" className="self-start">
                            {t("writtenByYou")}
                          </Badge>
                        ) : (
                          <EvidenceChip status={it.evidence_status} detail={evDetail} />
                        )}
                      </>
                    )}

                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-pressed={it.review_status === "kept"}
                        onClick={() => setReview(it, "kept")}
                        className={cn(
                          "inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-blue px-[18px] py-2 text-[15px] font-semibold transition-colors",
                          it.review_status === "kept" ? "bg-blue text-white" : "bg-white text-blue hover:bg-blue-tint",
                        )}
                      >
                        <Check size={16} aria-hidden="true" /> {t("keep")}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(it)}
                        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-white px-[18px] py-2 text-[15px] font-semibold text-ink hover:bg-surface"
                      >
                        <Pencil size={16} aria-hidden="true" /> {t("edit")}
                      </button>
                      <button
                        type="button"
                        aria-pressed={it.review_status === "removed"}
                        onClick={() => setReview(it, "removed")}
                        className={cn(
                          "inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-danger px-[18px] py-2 text-[15px] font-semibold transition-colors",
                          it.review_status === "removed"
                            ? "bg-danger text-white"
                            : "bg-white text-danger hover:bg-[#fdecea]",
                        )}
                      >
                        {it.review_status === "removed" ? (
                          <Undo2 size={16} aria-hidden="true" />
                        ) : (
                          <Trash2 size={16} aria-hidden="true" />
                        )}
                        {it.review_status === "removed" ? t("removed") : t("remove")}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {adding ? (
              <AddItemForm
                projectId={projectId}
                nextPosition={Math.max(0, ...items.map((i) => i.position)) + 1}
                onCancel={() => setAdding(false)}
                onAdded={(row) => {
                  setItems((cur) => [...cur, row]);
                  setSelected(row.id);
                  setAdding(false);
                  startTransition(() => router.refresh());
                }}
                onError={setError}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line-strong bg-white font-semibold text-blue hover:bg-blue-tint"
              >
                <Plus size={18} aria-hidden="true" /> {t("add")}
              </button>
            )}
          </section>

          <aside
            aria-label={t("sourceViewer")}
            className="sticky top-4 flex min-w-[280px] flex-[0_1_400px] flex-col gap-3 max-lg:static"
          >
            <Card className="flex flex-col gap-3 !rounded-3xl !p-5">
              <h2 className="m-0 text-base">{t("sourceTitle")}</h2>
              {sel && source ? (
                <>
                  <div className="font-code text-[13px] text-text-2">
                    {source.file}
                    {source.pageLabel ? ` · ${source.pageLabel}` : ""}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={sel.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-3"
                    >
                      <div className="rounded-[14px] border border-line-soft bg-white p-4 text-sm leading-[1.7] text-text-3">
                        {source.fileMissing ? (
                          <p className="m-0 italic text-text-2">{t("fileMissing")}</p>
                        ) : source.found ? (
                          <>
                            {source.before ? <p className="mb-3 mt-0">{source.before}</p> : null}
                            {source.quote ? (
                              <p className="mb-3 mt-0">
                                <mark className="rounded bg-[#F7D58A] px-1 py-0.5 text-ink">{source.quote}</mark>
                              </p>
                            ) : null}
                            {source.after ? <p className="m-0">{source.after}</p> : null}
                          </>
                        ) : (
                          <>
                            <p className="mb-3 mt-0 italic text-text-2">{t("noMatch")}</p>
                            {source.context ? <p className="m-0">{source.context}</p> : null}
                          </>
                        )}
                      </div>
                      {source.fileMissing ? null : source.found ? (
                        <div className="rounded-[14px] bg-ok-bg p-3 text-sm text-ok">
                          <strong>{t("matchedBold")}</strong> {t("matchedText")}
                        </div>
                      ) : (
                        <div className="rounded-[14px] bg-warn-bg p-3 text-sm text-warn-ink">
                          <strong>{t("notFoundBold")}</strong> {t("notFoundText")}
                          {source.quote ? (
                            <span className="mt-2 block text-[13px]">{t("aiClaimed", { quote: source.quote })}</span>
                          ) : null}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </>
              ) : (
                <p className="m-0 text-sm text-text-2">
                  {sel?.origin === "creator" ? t("ownNoSource") : t("selectItem")}
                </p>
              )}
            </Card>
          </aside>
        </div>
      </SegmentedTabs>

      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 !rounded-3xl !p-5">
        <div className="flex flex-col gap-1.5">
          <span aria-live="polite" className="text-[15px]">
            {footnote}
          </span>
          <span className={cn("text-[13px] font-semibold", checklist.advisor.done ? "text-ok" : "text-warn")}>
            {advisorOk
              ? checklist.advisor.status === "not_needed"
                ? t("advisorNotNeeded")
                : t("advisorApproved")
              : t("advisorPending")}
            {checklist.team.done ? "" : t("teamPending")}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/share/${projectId}/files`} variant="outline">
            {t("back")}
          </ButtonLink>
          {ready ? (
            <ButtonLink href={`/share/${projectId}/publish`} arrow>
              {t("continuePublish")}
            </ButtonLink>
          ) : (
            <Button disabled aria-disabled="true">
              {t("continuePublish")}
            </Button>
          )}
        </div>
      </Card>
    </LayoutGroup>
  );
}

function AddItemForm({
  projectId,
  nextPosition,
  onAdded,
  onCancel,
  onError,
}: {
  projectId: string;
  nextPosition: number;
  onAdded: (row: DraftItem) => void;
  onCancel: () => void;
  onError: (m: string) => void;
}) {
  const t = useTranslations("board");
  const L = useLabels();
  const supabase = useMemo(() => createClient(), []);
  const [kind, setKind] = useState<ItemKind>("next_task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [effort, setEffort] = useState<"small" | "medium" | "large">("medium");
  const [lessonType, setLessonType] = useState<"methodology" | "evaluation_feedback" | "funding_feedback" | "blocker">(
    "methodology",
  );
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) {
      setFieldError(t("titleMin"));
      return;
    }
    setSaving(true);
    const row = {
      project_id: projectId,
      kind,
      title: title.trim(),
      description: description.trim(),
      effort: kind === "next_task" ? effort : null,
      lesson_type: kind === "lesson" ? lessonType : null,
      objective_status: kind === "objective" ? "not_started" : null,
      evidence: [],
      evidence_status: "not_found",
      origin: "creator",
      review_status: "kept",
      position: nextPosition,
    };
    const { data, error } = await supabase.from("draft_items").insert(row).select("*").single();
    setSaving(false);
    if (error || !data) {
      onError(t("addFailed"));
      return;
    }
    onAdded(data as DraftItem);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-3xl border-2 border-blue bg-white p-4">
      <h3 className="m-0 text-base font-semibold tracking-normal">{t("addTitle")}</h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
        <SelectField label={t("type")} value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
          <option value="next_task">{L.itemKind.next_task}</option>
          <option value="objective">{L.itemKind.objective}</option>
          <option value="completed">{L.itemKind.completed}</option>
          <option value="lesson">{L.itemKind.lesson}</option>
        </SelectField>
        {kind === "next_task" ? (
          <SelectField label={t("effort")} value={effort} onChange={(e) => setEffort(e.target.value as typeof effort)}>
            <option value="small">{L.effort.small}</option>
            <option value="medium">{L.effort.medium}</option>
            <option value="large">{L.effort.large}</option>
          </SelectField>
        ) : null}
        {kind === "lesson" ? (
          <SelectField
            label={t("lessonType")}
            value={lessonType}
            onChange={(e) => setLessonType(e.target.value as typeof lessonType)}
          >
            {Object.entries(L.lesson).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </SelectField>
        ) : null}
      </div>
      <TextField label={t("fieldTitle")} value={title} onChange={(e) => setTitle(e.target.value)} error={fieldError} />
      {kind !== "lesson" ? (
        <TextArea
          label={t("descOptional")}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      ) : null}
      <p className="m-0 text-[13px] text-text-2">{t("ownNote")}</p>
      <div className="flex gap-2">
        <Button type="submit" size="md" disabled={saving}>
          {saving ? t("saving") : t("addItem")}
        </Button>
        <Button type="button" size="md" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

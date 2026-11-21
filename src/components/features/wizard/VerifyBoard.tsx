"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { ITEM_KIND_LABEL, LESSON_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { DraftItem, ItemKind, ReviewStatus } from "@/lib/db/types";
import type { SourceView, PublishChecklist } from "@/lib/db/owner";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "objective", label: "Objectives" },
  { id: "completed", label: "Completed" },
  { id: "next_task", label: "Next tasks" },
  { id: "lesson", label: "Lessons" },
];

const STATUS = {
  pending: { label: "Needs review", tone: "warn" as const },
  kept: { label: "Confirmed", tone: "ok" as const },
  removed: { label: "Removed", tone: "neutral" as const },
};

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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<string | null>(initialItems.find((i) => i.review_status === "pending")?.id ?? initialItems[0]?.id ?? null);
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
  const visible = items.filter((i) => filter === "all" || i.kind === filter);
  const sel = items.find((i) => i.id === selected) ?? null;
  const source = sel ? sources[sel.id] : null;

  async function persist(id: string, patch: Partial<DraftItem>, rollback: DraftItem) {
    const { error: err } = await supabase.from("draft_items").update(patch).eq("id", id);
    if (err) {
      setError("That change could not be saved. It may be locked because the project was published.");
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
    ? "All items reviewed. You can continue to the preview and publish."
    : total === 0
      ? "There are no drafted items yet. Add one by hand or go back and draft from your files."
      : !allReviewed
        ? reviewed === total && keptCount === 0
          ? "Keep at least one item before publishing."
          : `Review the remaining ${total - reviewed} ${total - reviewed === 1 ? "item" : "items"} to unlock publishing.`
        : !checklist.advisor.done
          ? "All items are reviewed. Publishing stays locked until your advisor approves."
          : "Every team member must confirm before you can publish.";

  return (
    <LayoutGroup>
      {mockMode ? (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-[18px] bg-warn-bg p-4 text-warn-ink">
          <FlaskConical size={20} className="mt-0.5 flex-none" aria-hidden="true" />
          <span>
            <strong>Simulated AI output (mock mode).</strong> These items were drafted by deterministic rules, not by a
            real AI model. One item is unsupported on purpose so you can see how missing evidence looks.
          </span>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-[280px] flex-[1_1_440px]">
          <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">Review the AI draft</h1>
          <p className="m-0 text-text-2">
            AI drafted these items from your files. Keep, edit or remove each one. Nothing is published until every item is reviewed.
          </p>
        </div>
        <div className="flex-[0_1_280px]">
          <div className="mb-1.5 text-sm" aria-live="polite">
            <strong>
              {reviewed} of {total} reviewed
            </strong>
          </div>
          <AnimatedBar pct={total ? (reviewed / total) * 100 : 0} track="#DDE1E5" label="Items reviewed" />
        </div>
      </div>

      {draftSummary && !summaryUsed && draftSummary.trim() !== summary.trim() ? (
        <Card tone="blue" className="mb-6">
          <h2 className="mb-1 mt-0 flex items-center gap-2 text-base">
            <Sparkles size={16} aria-hidden="true" /> Drafted summary
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
              Use this as my summary
            </Button>
            <Button size="md" variant="ghost" onClick={() => setSummaryUsed(true)}>
              Keep my own summary
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="mb-4">
        <SegmentedTabs
          label="Filter drafted items"
          value={filter}
          onChange={setFilter}
          tabs={FILTERS.map((f) => ({ ...f, count: undefined }))}
        />
      </div>

      {error ? (
        <div className="mb-4">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Drafted items" className="flex min-w-0 flex-[1_1_560px] flex-col gap-3">
          {visible.length === 0 ? (
            <Card tone="dashed" className="text-center text-text-2">
              {total === 0 ? "No items yet." : "No items in this group."}
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
                      {ITEM_KIND_LABEL[it.kind as ItemKind]}
                      {it.kind === "lesson" && it.lesson_type ? ` · ${LESSON_LABEL[it.lesson_type]}` : ""}
                      {it.origin === "creator" ? " · added by you" : ""}
                    </span>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={it.review_status}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  {editing === it.id ? (
                    <div className="flex flex-col gap-3">
                      <TextField label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                      {it.kind !== "lesson" ? (
                        <TextArea
                          label="Description"
                          rows={2}
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        />
                      ) : null}
                      <div className="flex gap-2">
                        <Button size="md" onClick={() => saveEdit(it)}>
                          Save
                        </Button>
                        <Button size="md" variant="outline" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelected(it.id)}
                        aria-label={`Show source for: ${it.title}`}
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
                          Written by you
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
                      <Check size={16} aria-hidden="true" /> Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(it)}
                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line-strong bg-white px-[18px] py-2 text-[15px] font-semibold text-ink hover:bg-surface"
                    >
                      <Pencil size={16} aria-hidden="true" /> Edit
                    </button>
                    <button
                      type="button"
                      aria-pressed={it.review_status === "removed"}
                      onClick={() => setReview(it, "removed")}
                      className={cn(
                        "inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-danger px-[18px] py-2 text-[15px] font-semibold transition-colors",
                        it.review_status === "removed" ? "bg-danger text-white" : "bg-white text-danger hover:bg-[#fdecea]",
                      )}
                    >
                      {it.review_status === "removed" ? <Undo2 size={16} aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
                      {it.review_status === "removed" ? "Removed" : "Remove"}
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
              <Plus size={18} aria-hidden="true" /> Add an item the draft missed
            </button>
          )}
        </section>

        <aside aria-label="Source viewer" className="sticky top-4 flex min-w-[280px] flex-[0_1_400px] flex-col gap-3 max-lg:static">
          <Card className="flex flex-col gap-3 !rounded-3xl !p-5">
            <h2 className="m-0 text-base">Source for the selected item</h2>
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
                        <p className="m-0 italic text-text-2">The source file or page is no longer available.</p>
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
                          <p className="mb-3 mt-0 italic text-text-2">No matching text on this page.</p>
                          {source.context ? <p className="m-0">{source.context}</p> : null}
                        </>
                      )}
                    </div>
                    {source.fileMissing ? null : source.found ? (
                      <div className="rounded-[14px] bg-ok-bg p-3 text-sm text-ok">
                        <strong>Evidence matched.</strong> The highlighted text exists in your file.
                      </div>
                    ) : (
                      <div className="rounded-[14px] bg-warn-bg p-3 text-sm text-warn-ink">
                        <strong>Evidence not found.</strong> ESTAFET could not find the quoted text in this file. The
                        draft may be a guess, so check it carefully or remove it.
                        {source.quote ? (
                          <span className="mt-2 block text-[13px]">
                            The AI claimed: &ldquo;{source.quote}&rdquo;
                          </span>
                        ) : null}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </>
            ) : (
              <p className="m-0 text-sm text-text-2">
                {sel?.origin === "creator" ? "You wrote this item, so it has no source file." : "Select an item to see where it came from."}
              </p>
            )}
          </Card>
        </aside>
      </div>

      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 !rounded-3xl !p-5">
        <div className="flex flex-col gap-1.5">
          <span aria-live="polite" className="text-[15px]">
            {footnote}
          </span>
          <span className={cn("text-[13px] font-semibold", checklist.advisor.done ? "text-ok" : "text-warn")}>
            {checklist.advisor.done ? "Advisor approved" : "Advisor approval pending"}
            {checklist.team.done ? "" : " · team confirmation pending"}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/share/${projectId}/files`} variant="outline">
            Back
          </ButtonLink>
          {ready ? (
            <ButtonLink href={`/share/${projectId}/publish`} arrow>
              Continue to publish
            </ButtonLink>
          ) : (
            <Button disabled aria-disabled="true">
              Continue to publish
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
  const supabase = useMemo(() => createClient(), []);
  const [kind, setKind] = useState<ItemKind>("next_task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [effort, setEffort] = useState<"small" | "medium" | "large">("medium");
  const [lessonType, setLessonType] = useState<"methodology" | "evaluation_feedback" | "funding_feedback" | "blocker">("methodology");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) {
      setFieldError("Write a title of at least 3 characters.");
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
      onError("Your item could not be saved. Please try again.");
      return;
    }
    onAdded(data as DraftItem);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-3xl border-2 border-blue bg-white p-4">
      <h3 className="m-0 text-base font-semibold tracking-normal">Add your own item</h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
        <SelectField label="Type" value={kind} onChange={(e) => setKind(e.target.value as ItemKind)}>
          <option value="next_task">Next task</option>
          <option value="objective">Objective</option>
          <option value="completed">Completed work</option>
          <option value="lesson">Lesson</option>
        </SelectField>
        {kind === "next_task" ? (
          <SelectField label="Effort" value={effort} onChange={(e) => setEffort(e.target.value as typeof effort)}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </SelectField>
        ) : null}
        {kind === "lesson" ? (
          <SelectField label="Lesson type" value={lessonType} onChange={(e) => setLessonType(e.target.value as typeof lessonType)}>
            {Object.entries(LESSON_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </SelectField>
        ) : null}
      </div>
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={fieldError} />
      {kind !== "lesson" ? (
        <TextArea label="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      ) : null}
      <p className="m-0 text-[13px] text-text-2">Items you write have no source file. They are marked &ldquo;Written by you&rdquo; and count as reviewed.</p>
      <div className="flex gap-2">
        <Button type="submit" size="md" disabled={saving}>
          {saving ? "Saving…" : "Add item"}
        </Button>
        <Button type="button" size="md" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

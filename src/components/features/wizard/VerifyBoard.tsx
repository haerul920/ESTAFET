"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { FileText, Check, Pencil, Plus, Trash2 } from "lucide-react";
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
import type { SourceView } from "@/lib/db/owner";
import { SaveExitButton } from "./SaveExit";
import { useToast } from "@/components/ui/Toast";
import { WizardActions } from "./WizardActions";

const DESCRIPTION_MIN = 10;

const FILTERS = [
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
  summary,
  draftSummary,
  manual = false,
}: {
  projectId: string;
  initialItems: DraftItem[];
  sources: Record<string, SourceView>;
  summary: string;
  draftSummary: string | null;
  /** The owners chose "Isi manual tanpa AI": no AI draft, no evidence checks, items are written by hand. */
  manual?: boolean;
}) {
  const t = useTranslations("board");
  const tf = useTranslations("fill");
  const L = useLabels();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(() => initialItems.filter((i) => i.kind === "next_task" || i.kind === "lesson"));
  // Open on the suggestions, or on the materials when there are only materials.
  const [filter, setFilter] = useState<string>(() => {
    const open = initialItems.filter((i) => i.review_status !== "removed");
    return !open.some((i) => i.kind === "next_task") && open.some((i) => i.kind === "lesson") ? "lesson" : "next_task";
  });
  const [selected, setSelected] = useState<string | null>(() => {
    const open = initialItems.filter((i) => i.kind === filter && i.review_status !== "removed");
    return open.find((i) => i.review_status === "pending")?.id ?? open[0]?.id ?? null;
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", description: "" });
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(manual && initialItems.length === 0);
  const [savingSummary, startTransition] = useTransition();
  // What is saved on the project wins. The text of the last AI run is only a fallback.
  const [summaryText, setSummaryText] = useState(() => (summary?.trim() || draftSummary || "").trim());
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraftInput, setSummaryDraftInput] = useState(summaryText);
  const toast = useToast();

  // A removed item is gone from the board. It stays in the database as "removed", so Undo can bring it back.
  const shown = items.filter((i) => i.review_status !== "removed");
  const total = shown.length;
  const reviewed = shown.filter((i) => i.review_status !== "pending").length;
  const keptCount = shown.filter((i) => i.review_status === "kept").length;
  const allReviewed = total > 0 && reviewed === total && keptCount > 0;
  // Review only needs the items. Team consent comes on the next step ("Team and access").
  const ready = allReviewed;
  const visible = shown.filter((i) => i.kind === filter);
  // The progress under the tabs belongs to the open tab. Going on still needs both tabs done.
  const tabReviewed = visible.filter((i) => i.review_status !== "pending").length;
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

  function removeItem(item: DraftItem) {
    const next = shown.filter((i) => i.id !== item.id && i.kind === item.kind);
    if (editing === item.id) setEditing(null);
    setSelected(next[0]?.id ?? null);
    setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, review_status: "removed" } : i)));
    void persist(item.id, { review_status: "removed" }, item);
    toast.push({
      message: t("removedToast", { title: item.title.slice(0, 60) }),
      undo: async () => {
        const { error: err } = await supabase
          .from("draft_items")
          .update({ review_status: item.review_status })
          .eq("id", item.id);
        if (err) return { error: t("saveFailed") };
        setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, review_status: item.review_status } : i)));
        setFilter(item.kind);
        setSelected(item.id);
        startTransition(() => router.refresh());
        return {};
      },
    });
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
    if (item.kind === "next_task" && draft.description.trim().length < DESCRIPTION_MIN) {
      setError(t("descRequired", { min: DESCRIPTION_MIN }));
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
      : reviewed === total && keptCount === 0
        ? t("footKeepOne")
        : t("footRemaining", { count: total - reviewed });

  return (
    <LayoutGroup>
      {manual ? (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-[18px] bg-blue-tint p-4 text-blue-dark"
        >
          <span>
            <strong>{tf("manualBadge")}.</strong> {tf("manualBanner")}
          </span>
          <ButtonLink href={`/bagikan/${projectId}/berkas`} variant="outlineBlue" size="md">
            {tf("switchBtn")}
          </ButtonLink>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">{t("title")}</h1>
          <p className="m-0 text-text-2">{manual ? t("introManual") : t("intro")}</p>
        </div>
      </div>

      {/* Always here: this is where the summary is written, also when there is none yet. */}
      <Card tone="blue" className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 flex items-center gap-2 text-base">
            <FileText size={16} aria-hidden="true" /> {t("summaryTitle")}
          </h2>
          {!editingSummary ? (
            <button
              type="button"
              onClick={() => {
                setSummaryDraftInput(summaryText);
                setEditingSummary(true);
              }}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-blue bg-white px-3.5 py-1 text-sm font-semibold text-blue hover:bg-blue-tint"
            >
              <Pencil size={14} aria-hidden="true" /> {summaryText ? t("edit") : t("summaryWrite")}
            </button>
          ) : null}
        </div>
        {editingSummary ? (
          <div className="flex flex-col gap-3">
            <TextArea
              label={t("summaryTitle")}
              hint={t("summaryHelp")}
              rows={5}
              maxLength={700}
              value={summaryDraftInput}
              onChange={(e) => setSummaryDraftInput(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="md"
                loading={savingSummary}
                disabled={savingSummary}
                onClick={() =>
                  startTransition(async () => {
                    const next = summaryDraftInput.trim();
                    const r = await applyDraftSummary(projectId, next);
                    if (r.error) setError(r.error);
                    else {
                      setSummaryText(next);
                      setEditingSummary(false);
                      router.refresh();
                    }
                  })
                }
              >
                {t("save")}
              </Button>
              <Button size="md" variant="outline" onClick={() => setEditingSummary(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="m-0 text-[15px] text-text-3">{summaryText || t("summaryEmpty")}</p>
        )}
      </Card>

      {/* The next steps are the owners' advice. Nobody who continues the project has to follow them. */}
      <p className="mb-3 mt-0 text-[15px] text-text-2">{t("suggestNote")}</p>

      <SegmentedTabs
        label={t("filterLabel")}
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setSelected(shown.find((i) => i.kind === next)?.id ?? null);
        }}
        tabs={FILTERS.map((f) => ({ id: f.id, label: t(f.key), count: shown.filter((i) => i.kind === f.id).length }))}
      >
        <div className="mb-4">
          <div className="mb-1.5 text-sm" aria-live="polite">
            <strong>{t("reviewedCount", { reviewed: tabReviewed, total: visible.length })}</strong>
          </div>
          <AnimatedBar
            key={filter}
            pct={visible.length ? (tabReviewed / visible.length) * 100 : 0}
            track="#DDE1E5"
            label={t("barLabel")}
          />
        </div>

        {error ? (
          <div className="mb-4">
            <FormMessage tone="error">{error}</FormMessage>
          </div>
        ) : null}

        <div className="flex flex-col gap-6">
          <section aria-label={t("itemsLabel")} className="flex min-w-0 flex-col gap-3">
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
                        onClick={() => removeItem(it)}
                        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-danger bg-white px-[18px] py-2 text-[15px] font-semibold text-danger transition-colors hover:bg-[#fdecea]"
                      >
                        <Trash2 size={16} aria-hidden="true" /> {t("remove")}
                      </button>
                    </div>
                    {/* The evidence of the chosen item, right under it. */}
                    {isSel ? (
                      <div
                        role="region"
                        aria-label={t("sourceViewer")}
                        className="flex flex-col gap-3 border-t border-line-soft pt-3"
                      >
                        <h3 className="m-0 text-base">{t("sourceTitle")}</h3>
                        {sel && source && sel.evidence.length > 0 ? (
                          <>
                            <div className="font-code text-[13px] text-text-2">
                              {source.file}
                              {source.pageLabel ? ` · ${source.pageLabel}` : ""}
                            </div>
                            {source.fromImage ? (
                              <p className="m-0 rounded-[12px] bg-warn-bg px-3 py-2 text-[13px] text-warn-ink">
                                {t("fromImage")}
                              </p>
                            ) : null}
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
                                          <mark className="rounded bg-[#F7D58A] px-1 py-0.5 text-ink">
                                            {source.quote}
                                          </mark>
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
                                      <span className="mt-2 block text-[13px]">
                                        {t("aiClaimed", { quote: source.quote })}
                                      </span>
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
                      </div>
                    ) : null}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {adding ? (
              <AddItemForm
                key={filter}
                projectId={projectId}
                kind={filter === "lesson" ? "lesson" : "next_task"}
                nextPosition={Math.max(0, ...items.map((i) => i.position)) + 1}
                onCancel={() => setAdding(false)}
                onAdded={(row) => {
                  setItems((cur) => [...cur, row]);
                  setFilter(row.kind);
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
        </div>
      </SegmentedTabs>

      <div
        className="mt-8 flex flex-col gap-4"
        // An open edit form is not saved yet, so "Save and exit" asks first.
        data-unsaved={editing !== null || editingSummary || adding || undefined}
      >
        <p aria-live="polite" className="m-0 text-[15px]">
          {footnote}
        </p>
        <WizardActions
          left={
            <ButtonLink href={`/bagikan/${projectId}/berkas`} variant="outline" size="lg">
              {t("back")}
            </ButtonLink>
          }
        >
          <SaveExitButton />
          {ready ? (
            <ButtonLink href={`/bagikan/${projectId}/tim`} arrow size="lg">
              {t("continueTeam")}
            </ButtonLink>
          ) : (
            <Button size="lg" arrow disabled aria-disabled="true">
              {t("continueTeam")}
            </Button>
          )}
        </WizardActions>
      </div>
    </LayoutGroup>
  );
}

function AddItemForm({
  projectId,
  kind,
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
  /** Follows the open tab. */
  kind: "next_task" | "lesson";
}) {
  const t = useTranslations("board");
  const L = useLabels();
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lessonType, setLessonType] = useState<"methodology" | "evaluation_feedback" | "funding_feedback" | "blocker">(
    "methodology",
  );
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const titleMissing = title.trim().length < 3;
    // Suggestions are shown with their description, so one is required. A lesson is its title and type.
    const descriptionMissing = kind === "next_task" && description.trim().length < DESCRIPTION_MIN;
    setFieldError(titleMissing ? t("titleMin") : "");
    setDescriptionError(descriptionMissing ? t("descRequired", { min: DESCRIPTION_MIN }) : "");
    if (titleMissing || descriptionMissing) return;
    setSaving(true);
    const row = {
      project_id: projectId,
      kind,
      title: title.trim(),
      description: description.trim(),
      lesson_type: kind === "lesson" ? lessonType : null,
      objective_status: null,
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
      <div className="flex flex-col gap-3">
        {kind === "lesson" ? (
          <SelectField
            label={t("lessonType")}
            value={lessonType}
            onValueChange={(next) => setLessonType(next as typeof lessonType)}
            options={Object.entries(L.lesson).map(([value, label]) => ({ value, label }))}
          />
        ) : null}
      </div>
      <TextField label={t("fieldTitle")} value={title} onChange={(e) => setTitle(e.target.value)} error={fieldError} />
      {kind !== "lesson" ? (
        <TextArea
          label={t("fieldDescription")}
          error={descriptionError}
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

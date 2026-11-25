"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Loader2, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormMessage } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SaveExitButton } from "./SaveExit";
import { confirmTeamConsent, deleteFile } from "@/app/actions/projects";
import { cancelAiDraft, setFillMode } from "@/app/actions/owner";
import { cn } from "@/lib/cn";
import type { ProjectFile } from "@/lib/db/types";

import { useLabels } from "@/lib/use-labels";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { ACCEPT_ATTRIBUTE } from "@/lib/ingest/accept";
import { FileKindIcon } from "@/components/features/FileKindIcon";
import { WizardActions } from "./WizardActions";
import { PdfPreview } from "@/components/features/PdfPreview";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** One line on the upload step (CLAUDE.md section 8). The full explanation is on the Privacy page. */
function DataNotice() {
  const t = useTranslations("files");
  return (
    <p className="m-0 flex items-start gap-2 rounded-[18px] bg-blue-tint px-4 py-3 text-[15px] text-text-3">
      <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 flex-none text-blue" />
      <span>
        {t("noticeLine")}{" "}
        <Link href="/privacy#berkas" target="_blank" className="font-semibold text-blue">
          {t("noticeLink")}
        </Link>
      </span>
    </p>
  );
}

export function FilesStep({
  projectId,
  files,
  itemCount,
  aiItemCount,
  canSynthesize,
  blockReason,
  selfConsented,
  othersPending,
  fillMode,
  maxMb,
}: {
  projectId: string;
  files: ProjectFile[];
  itemCount: number;
  /** Items the AI drafted. They are removed when the owners take the AI back. */
  aiItemCount: number;
  canSynthesize: boolean;
  blockReason: string;
  /** The signed-in owner already confirmed that the team agrees to share (and to AI reading the files). */
  selfConsented: boolean;
  /** Active team members other than the signed-in owner who have not confirmed yet. */
  othersPending: number;
  fillMode: "ai" | "manual" | null;
  /** The upload limit in force, for the line under the button. */
  maxMb: number;
}) {
  const t = useTranslations("files");
  const tf = useTranslations("fill");
  const L = useLabels();
  const locale = useLocale();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState<{ name: string; ok: boolean; note: string }[]>([]);
  const [error, setError] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [removing, startRemoving] = useTransition();
  // "Isi manual" sits next to "Susun draf dengan AI" while nothing of the AI exists yet (QA note): both ways forward,
  // side by side. Once the AI made something, switching goes through the confirmation in the manual card instead.
  const [goingManual, startGoingManual] = useTransition();
  const canGoManual = fillMode !== "manual" && fillMode !== "ai" && aiItemCount === 0;
  function goManual() {
    startGoingManual(async () => {
      setError("");
      const r = await setFillMode(projectId, "manual");
      if (r.error) {
        setError(r.error);
        return;
      }
      router.push(`/bagikan/${projectId}/tinjau`);
    });
  }
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const upload = useCallback(
    async (list: FileList | File[]) => {
      const arr = Array.from(list);
      if (arr.length === 0) return;
      setUploading(true);
      setError("");
      setMessages([]);
      try {
        // 1. Ask for one upload address per file. 2. Send each file straight to storage. 3. Let the server check them.
        const post = async <T,>(path: string, body: unknown) => {
          const res = await fetch(`/api/projects/${projectId}/files${path}?lang=${locale}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = (await res.json().catch(() => ({}))) as T & { error?: string };
          return { ok: res.ok, json };
        };
        const asked = await post<{ tickets?: { name: string; path?: string; token?: string; error?: string }[] }>(
          "/prepare",
          { files: arr.map((f) => ({ name: f.name, size: f.size })) },
        );
        if (!asked.ok) {
          setError(asked.json.error ?? t("uploadFailed"));
          return;
        }
        const failed: { name: string; ok: boolean; note: string }[] = [];
        const sent: { path: string; name: string }[] = [];
        const storage = createBrowserSupabase().storage.from("project-files");
        for (const [index, ticket] of (asked.json.tickets ?? []).entries()) {
          if (!ticket.path || !ticket.token) {
            failed.push({ name: ticket.name, ok: false, note: ticket.error ?? t("uploadFailed") });
            continue;
          }
          const { error: sendError } = await storage.uploadToSignedUrl(ticket.path, ticket.token, arr[index], {
            contentType: arr[index].type || "application/octet-stream",
          });
          if (sendError) failed.push({ name: ticket.name, ok: false, note: t("uploadFailed") });
          else sent.push({ path: ticket.path, name: ticket.name });
        }
        if (sent.length > 0) {
          const checked = await post<{ outcomes?: { name: string; ok: boolean; note: string }[] }>("", {
            uploads: sent,
          });
          if (!checked.ok) setError(checked.json.error ?? t("uploadFailed"));
          else failed.push(...(checked.json.outcomes ?? []).filter((o) => !o.ok));
        }
        setMessages(failed);
        router.refresh();
      } catch {
        setError(t("uploadOffline"));
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [projectId, router, locale, t],
  );

  async function draftAndContinue() {
    setDrafting(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/synthesize?lang=${locale}`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? t("draftFailed"));
        setDrafting(false);
        return;
      }
      router.push(`/bagikan/${projectId}/tinjau`);
    } catch {
      setError(t("draftFailedRetry"));
      setDrafting(false);
    }
  }

  const readable = files.filter((f) => f.extracted_text_path).length;

  return (
    <div className="flex flex-col gap-6">
      <DataNotice />

      <FillChoice
        projectId={projectId}
        selfConsented={selfConsented}
        othersPending={othersPending}
        fillMode={fillMode}
        aiItemCount={aiItemCount}
        onError={setError}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-[28px] border-2 border-dashed bg-white p-8 text-center transition-colors",
          dragging ? "border-blue bg-blue-tint" : "border-line-strong",
        )}
      >
        <motion.div
          animate={dragging ? { y: -6, scale: 1.1 } : { y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
        >
          {uploading ? (
            <Loader2 size={36} className="animate-spin text-blue" aria-hidden="true" />
          ) : (
            <UploadCloud size={36} className="text-blue" aria-hidden="true" />
          )}
        </motion.div>
        <div className="font-semibold">{uploading ? t("reading") : t("drop")}</div>
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          // Hidden: the "choose files" button opens it. It still needs a name, and must not be a second Tab stop.
          aria-label={t("choose")}
          tabIndex={-1}
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={(e) => e.target.files && void upload(e.target.files)}
        />
        <Button
          variant="outlineBlue"
          onClick={() => inputRef.current?.click()}
          loading={uploading}
          disabled={uploading}
        >
          {t("choose")}
        </Button>
        <p className="m-0 text-sm text-text-2">{t("accepted", { mb: maxMb })}</p>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {messages.map((m) => (
          <FormMessage key={m.name} tone="error">
            <strong>{m.name}:</strong> {m.note}
          </FormMessage>
        ))}
      </div>

      <Card as="section" aria-labelledby="files-h">
        <h2 id="files-h" className="mb-4 mt-0 text-lg">
          {t("uploaded")}
        </h2>
        {files.length === 0 ? (
          <p className="m-0 text-text-2">{t("noFiles")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            <AnimatePresence initial={false}>
              {files.map((f) => {
                return (
                  <motion.li
                    key={f.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-2 rounded-[18px] border border-line-soft bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 font-code text-sm">
                        <FileKindIcon kind={f.kind} />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{f.original_name}</span>
                      </span>
                      <span className="ml-auto flex flex-wrap items-center justify-end gap-2 text-[13px] text-text-2">
                        {L.fileKind[f.kind]} · {formatSize(f.size_bytes)}
                        {f.kind === "pdf" && f.storage_path ? (
                          <PdfPreview projectId={projectId} fileId={f.id} name={f.original_name} />
                        ) : null}
                        {confirmDelete === f.id ? (
                          <span className="flex items-center gap-2">
                            <Button
                              variant="danger"
                              size="sm"
                              loading={removing}
                              disabled={removing}
                              onClick={() =>
                                startRemoving(async () => {
                                  const r = await deleteFile(projectId, f.id);
                                  if (r.error) setError(r.error);
                                  setConfirmDelete(null);
                                  router.refresh();
                                })
                              }
                            >
                              {t("removeFile")}
                            </Button>
                            <button
                              type="button"
                              className="cursor-pointer text-sm font-semibold text-blue"
                              onClick={() => setConfirmDelete(null)}
                            >
                              {t("keep")}
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label={t("removeAria", { name: f.original_name })}
                            onClick={() => setConfirmDelete(f.id)}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full hover:bg-surface"
                          >
                            <Trash2 size={18} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge tone={f.ingest_status === "ready" ? "ok" : "warn"}>
                        {f.ingest_status === "ready" ? t("ready") : t("check")}
                      </Badge>
                      <span className="text-sm text-text-3">{f.ingest_note}</span>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      {!canSynthesize && readable > 0 ? <FormMessage tone="error">{blockReason}</FormMessage> : null}

      <WizardActions
        left={
          <ButtonLink href={`/bagikan/${projectId}/info`} variant="outline" size="lg">
            {t("back")}
          </ButtonLink>
        }
      >
        <SaveExitButton />
        {itemCount > 0 || fillMode === "manual" ? (
          <ButtonLink href={`/bagikan/${projectId}/tinjau`} arrow size="lg">
            {t("toVerify")}
          </ButtonLink>
        ) : (
          <>
            {canGoManual ? (
              <Button
                variant="outline"
                size="lg"
                loading={goingManual}
                // The files are what the next team receives: "manual" is not a way to skip the upload (QA note).
                disabled={files.length === 0 || goingManual || drafting}
                aria-describedby={files.length === 0 ? "manual-needs-file" : undefined}
                onClick={goManual}
              >
                {tf("manualBtn")}
              </Button>
            ) : null}
            <Button
              size="lg"
              arrow
              loading={drafting}
              disabled={!canSynthesize || readable === 0 || drafting || goingManual}
              onClick={draftAndContinue}
            >
              {drafting ? t("drafting") : t("draftBtn")}
            </Button>
          </>
        )}
      </WizardActions>
      {drafting ? (
        <p role="status" className="m-0 text-sm text-text-2">
          {t("draftingText")}
        </p>
      ) : null}
      {canGoManual && files.length === 0 && itemCount === 0 ? (
        <p id="manual-needs-file" className="m-0 text-sm text-text-2">
          {t("uploadFirst")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The two ways to fill the project. Nothing is read by an AI provider before the team agreed (CLAUDE.md 14.5):
 * the AI path needs the owner's own consent here and every other active member to have confirmed. Manual needs no one.
 */
function FillChoice({
  projectId,
  selfConsented,
  othersPending,
  fillMode,
  aiItemCount,
  onError,
}: {
  projectId: string;
  selfConsented: boolean;
  othersPending: number;
  fillMode: "ai" | "manual" | null;
  aiItemCount: number;
  onError: (message: string) => void;
}) {
  const t = useTranslations("fill");
  const router = useRouter();
  const [pending, start] = useTransition();

  // Which of the two choices is running, so only that button shows the spinner (set outside the transition).
  const [choice, setChoice] = useState<"ai" | null>(null);

  function consent() {
    setChoice("ai");
    start(async () => {
      onError("");
      const r = await confirmTeamConsent(projectId);
      if (r.error) onError(r.error);
      else await setFillMode(projectId, "ai");
      router.refresh();
    });
  }

  // Neither choice is final: whatever the AI did can be taken back, and then both are open again.
  const aiChosen = fillMode !== "manual" && (selfConsented || fillMode === "ai" || aiItemCount > 0);
  const aiToRemove = fillMode === "ai" || aiItemCount > 0;

  async function removeAi() {
    onError("");
    return cancelAiDraft(projectId);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card tone={aiChosen ? "lime" : "white"} className="flex flex-col gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg">
          <ShieldCheck size={18} aria-hidden="true" /> {t("aiTitle")}
        </h2>
        <p className="m-0 text-[15px] text-text-3">{t("aiText")}</p>
        <div className="rounded-[14px] bg-surface p-3.5 text-sm">
          <strong className="mb-1 block">{t("consentTitle")}</strong>
          {t("consentText")}
          {selfConsented ? (
            <p className="mb-0 mt-2 font-semibold text-ok">{t("consentDone")}</p>
          ) : (
            <div className="mt-3">
              <Button
                variant="outlineBlue"
                size="md"
                onClick={consent}
                loading={pending && choice === "ai"}
                disabled={pending}
                // a long label: let it wrap instead of pushing the page sideways on small phones
                className="h-auto max-w-full whitespace-normal py-2.5 text-center"
              >
                {t("consentBtn")}
              </Button>
            </div>
          )}
          {selfConsented && othersPending > 0 ? <p className="mb-0 mt-2 text-warn-ink">{t("consentOthers")}</p> : null}
        </div>
        {selfConsented || aiToRemove ? (
          <div>
            <ConfirmDialog
              trigger={t("cancelAi")}
              triggerVariant="danger"
              tone="danger"
              title={t("cancelTitle")}
              effect={t("cancelEffect", { count: aiItemCount })}
              confirmLabel={t("cancelConfirm")}
              onConfirm={removeAi}
              onDone={() => router.refresh()}
            />
          </div>
        ) : null}
      </Card>
      <Card tone={fillMode === "manual" ? "lime" : "white"} className="flex flex-col gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg">
          <FileText size={18} aria-hidden="true" /> {t("manualTitle")}
        </h2>
        <p className="m-0 text-[15px] text-text-3">{t("manualText")}</p>
        <div className="mt-auto">
          {fillMode === "manual" ? null : aiToRemove ? (
            <ConfirmDialog
              trigger={t("manualBtn")}
              tone="danger"
              title={t("cancelTitle")}
              effect={t("cancelEffect", { count: aiItemCount })}
              confirmLabel={t("cancelConfirmManual")}
              onConfirm={async () => {
                const removed = await removeAi();
                return removed.error ? removed : setFillMode(projectId, "manual");
              }}
              onDone={() => router.push(`/bagikan/${projectId}/tinjau`)}
            />
          ) : (
            <p className="m-0 text-sm text-text-2">{t("manualBelow")}</p>
          )}
        </div>
      </Card>
    </div>
  );
}

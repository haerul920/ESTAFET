"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, FileCode2, Loader2, ShieldCheck, Trash2, UploadCloud, FileArchive } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormMessage } from "@/components/ui/Field";
import { confirmTeamConsent, deleteFile } from "@/app/actions/projects";
import { setFillMode } from "@/app/actions/owner";
import { cn } from "@/lib/cn";
import type { ProjectFile } from "@/lib/db/types";

import { useLabels } from "@/lib/use-labels";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function DataNotice() {
  const t = useTranslations("files");
  return (
    <Card tone="blue">
      <h2 className="mb-2 mt-0 flex items-center gap-2 text-base">
        <ShieldCheck size={18} aria-hidden="true" /> {t("noticeTitle")}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[15px] text-text-3">
        <li>
          <strong>{t("readLabel")}</strong> {t("readText")}
        </li>
        <li>
          <strong>{t("whoLabel")}</strong> {t("whoText")}
        </li>
        <li>
          <strong>{t("privateLabel")}</strong> {t("privateText")}
        </li>
        <li>
          <strong>{t("skippedLabel")}</strong> {t.rich("skippedText", { env: () => <code className="font-code">.env</code> })}
        </li>
      </ul>
    </Card>
  );
}

export function FilesStep({
  projectId,
  files,
  itemCount,
  canSynthesize,
  blockReason,
  mockMode,
  selfConsented,
  othersPending,
  fillMode,
}: {
  projectId: string;
  files: ProjectFile[];
  itemCount: number;
  canSynthesize: boolean;
  blockReason: string;
  mockMode: boolean;
  /** The signed-in owner already confirmed that the team agrees to share (and to AI reading the files). */
  selfConsented: boolean;
  /** Active team members other than the signed-in owner who have not confirmed yet. */
  othersPending: number;
  fillMode: "ai" | "manual" | null;
}) {
  const t = useTranslations("files");
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const upload = useCallback(
    async (list: FileList | File[]) => {
      const arr = Array.from(list);
      if (arr.length === 0) return;
      setUploading(true);
      setError("");
      setMessages([]);
      try {
        const fd = new FormData();
        for (const f of arr) fd.append("files", f);
        const res = await fetch(`/api/projects/${projectId}/files?lang=${locale}`, { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({}))) as { error?: string; outcomes?: { name: string; ok: boolean; note: string }[] };
        if (!res.ok) setError(json.error ?? t("uploadFailed"));
        else setMessages((json.outcomes ?? []).filter((o) => !o.ok));
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
        hasItems={itemCount > 0}
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
        <motion.div animate={dragging ? { y: -6, scale: 1.1 } : { y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
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
          multiple
          accept=".pdf,.md,.markdown,.zip,application/pdf,text/markdown,application/zip"
          className="sr-only"
          onChange={(e) => e.target.files && void upload(e.target.files)}
        />
        <Button variant="outlineBlue" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {t("choose")}
        </Button>
        <p className="m-0 text-sm text-text-2">
          {t("accepted")}
        </p>
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
                const Icon = f.kind === "pdf" ? FileText : f.kind === "markdown" ? FileCode2 : FileArchive;
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
                      <span className="flex items-center gap-2 font-code text-sm">
                        <Icon size={18} aria-hidden="true" className="text-text-2" />
                        {f.original_name}
                      </span>
                      <span className="flex items-center gap-2 text-[13px] text-text-2">
                        {L.fileKind[f.kind]} · {formatSize(f.size_bytes)}
                        {confirmDelete === f.id ? (
                          <span className="flex items-center gap-2">
                            <Button
                              variant="danger"
                              size="sm"
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
                            <button type="button" className="cursor-pointer text-sm font-semibold text-blue" onClick={() => setConfirmDelete(null)}>
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
                      <Badge tone={f.ingest_status === "ready" ? "ok" : "warn"}>{f.ingest_status === "ready" ? t("ready") : t("check")}</Badge>
                      <span className="text-sm text-text-3">{f.ingest_note}</span>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      {!canSynthesize && readable > 0 ? (
        <FormMessage tone="error">{blockReason}</FormMessage>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        <ButtonLink href={`/bagikan/${projectId}/info`} variant="outline">
          {t("back")}
        </ButtonLink>
        {itemCount > 0 ? (
          <ButtonLink href={`/bagikan/${projectId}/tinjau`} arrow size="lg">
            {t("toVerify")}
          </ButtonLink>
        ) : (
          <Button size="lg" arrow disabled={!canSynthesize || readable === 0 || drafting} onClick={draftAndContinue}>
            {drafting ? t("drafting") : t("draftBtn")}
          </Button>
        )}
      </div>
      {drafting ? (
        <p role="status" className="m-0 text-sm text-text-2">
          {mockMode ? t("mockPrefix") : ""}
          {t("draftingText")}
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
  hasItems,
  onError,
}: {
  projectId: string;
  selfConsented: boolean;
  othersPending: number;
  fillMode: "ai" | "manual" | null;
  hasItems: boolean;
  onError: (message: string) => void;
}) {
  const t = useTranslations("fill");
  const router = useRouter();
  const [pending, start] = useTransition();

  function consent() {
    start(async () => {
      onError("");
      const r = await confirmTeamConsent(projectId);
      if (r.error) onError(r.error);
      else await setFillMode(projectId, "ai");
      router.refresh();
    });
  }

  function manual() {
    start(async () => {
      onError("");
      const r = await setFillMode(projectId, "manual");
      if (r.error) {
        onError(r.error);
        return;
      }
      router.push(`/bagikan/${projectId}/tinjau`);
    });
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
      <Card tone={fillMode === "manual" ? "white" : "lime"} className="flex flex-col gap-3">
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
              <Button variant="outlineBlue" size="md" onClick={consent} disabled={pending}>
                {t("consentBtn")}
              </Button>
            </div>
          )}
          {selfConsented && othersPending > 0 ? <p className="mb-0 mt-2 text-warn-ink">{t("consentOthers")}</p> : null}
        </div>
      </Card>
      <Card tone={fillMode === "manual" ? "lime" : "white"} className="flex flex-col gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg">
          <FileText size={18} aria-hidden="true" /> {t("manualTitle")}
        </h2>
        <p className="m-0 text-[15px] text-text-3">{t("manualText")}</p>
        <div className="mt-auto">
          {hasItems && fillMode !== "manual" ? null : (
            <Button variant="outline" size="md" onClick={manual} disabled={pending}>
              {t("manualBtn")}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

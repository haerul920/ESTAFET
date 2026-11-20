"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, FileCode2, Loader2, ShieldCheck, Trash2, UploadCloud, FileArchive } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormMessage } from "@/components/ui/Field";
import { deleteFile } from "@/app/actions/projects";
import { cn } from "@/lib/cn";
import type { ProjectFile } from "@/lib/db/types";

const KIND_LABEL = { pdf: "PDF", markdown: "Markdown", code_tree: "Code folder tree" } as const;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function DataNotice() {
  return (
    <Card tone="blue">
      <h2 className="mb-2 mt-0 flex items-center gap-2 text-base">
        <ShieldCheck size={18} aria-hidden="true" /> How your files are used
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[15px] text-text-3">
        <li>
          <strong>What is read:</strong> the text of your PDFs and Markdown notes, and for a ZIP only the folder tree, the
          README and package manifests. Source code is never read.
        </li>
        <li>
          <strong>Who reads it:</strong> ESTAFET&apos;s drafting step (an AI model, or a simulated one in mock mode), and
          only after your team and advisor have consented.
        </li>
        <li>
          <strong>What stays private:</strong> your files are stored privately. Only the title, summary, objectives,
          verified tasks and lessons you approve become public.
        </li>
        <li>
          <strong>Skipped for safety:</strong> files such as <code className="font-code">.env</code>, keys and
          credentials, and text that looks like a secret.
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
}: {
  projectId: string;
  files: ProjectFile[];
  itemCount: number;
  canSynthesize: boolean;
  blockReason: string;
  mockMode: boolean;
}) {
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
        const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({}))) as { error?: string; outcomes?: { name: string; ok: boolean; note: string }[] };
        if (!res.ok) setError(json.error ?? "The upload failed. Please try again.");
        else setMessages((json.outcomes ?? []).filter((o) => !o.ok));
        router.refresh();
      } catch {
        setError("The upload failed. Check your connection and try again.");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [projectId, router],
  );

  async function draftAndContinue() {
    setDrafting(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/synthesize`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "The draft could not be created.");
        setDrafting(false);
        return;
      }
      router.push(`/share/${projectId}/verify`);
    } catch {
      setError("The draft could not be created. Please try again.");
      setDrafting(false);
    }
  }

  const readable = files.filter((f) => f.extracted_text_path).length;

  return (
    <div className="flex flex-col gap-6">
      <DataNotice />

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
        <div className="font-semibold">{uploading ? "Reading your files…" : "Drop files here"}</div>
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
          Choose files
        </Button>
        <p className="m-0 text-sm text-text-2">
          Accepted: PDF reports, Markdown notes (.md), and a ZIP of your code folder. Up to 25 MB per file.
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
          Uploaded files
        </h2>
        {files.length === 0 ? (
          <p className="m-0 text-text-2">No files yet. Add at least one PDF, Markdown note or ZIP to continue.</p>
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
                        {KIND_LABEL[f.kind]} · {formatSize(f.size_bytes)}
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
                              Remove file
                            </Button>
                            <button type="button" className="cursor-pointer text-sm font-semibold text-blue" onClick={() => setConfirmDelete(null)}>
                              Keep
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Remove ${f.original_name}`}
                            onClick={() => setConfirmDelete(f.id)}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full hover:bg-surface"
                          >
                            <Trash2 size={18} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge tone={f.ingest_status === "ready" ? "ok" : "warn"}>{f.ingest_status === "ready" ? "Ready" : "Check"}</Badge>
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
        <ButtonLink href={`/share/${projectId}/consent`} variant="outline">
          Back
        </ButtonLink>
        {itemCount > 0 ? (
          <ButtonLink href={`/share/${projectId}/verify`} arrow size="lg">
            Continue to verification
          </ButtonLink>
        ) : (
          <Button size="lg" arrow disabled={!canSynthesize || readable === 0 || drafting} onClick={draftAndContinue}>
            {drafting ? "Drafting…" : "Draft with AI and continue"}
          </Button>
        )}
      </div>
      {drafting ? (
        <p role="status" className="m-0 text-sm text-text-2">
          {mockMode ? "Simulated AI output (mock mode). " : ""}Reading your files and checking every quoted line against the
          source. This usually takes a few seconds.
        </p>
      ) : null}
    </div>
  );
}

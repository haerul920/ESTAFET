"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { FormMessage } from "@/components/ui/Field";

type State = { status: "loading" } | { status: "failed" } | { status: "ready"; url: string; inPage: boolean };

/**
 * Shows a private PDF in the browser's own viewer. The address is asked for each time the window opens, after the
 * server checked access, and expires after a few minutes.
 */
export function PdfPreview({ projectId, fileId, name }: { projectId: string; fileId: string; name: string }) {
  const t = useTranslations("pdfPreview");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "loading" });

  async function load() {
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/projects/${projectId}/files/${fileId}/download?preview=1&lang=${locale}`);
      const json = (await res.json()) as { url?: string };
      if (!res.ok || !json.url) return setState({ status: "failed" });
      // Some phone browsers have no built-in viewer. `pdfViewerEnabled` says so.
      setState({ status: "ready", url: json.url, inPage: navigator.pdfViewerEnabled !== false });
    } catch {
      setState({ status: "failed" });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t("openAria", { name })}>
          <Eye size={16} aria-hidden="true" /> {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={name}
        className="flex h-[92dvh] max-h-[92dvh] w-[min(1000px,calc(100vw-1.5rem))] flex-col gap-3 overflow-hidden p-4 sm:p-5 [&>h2]:truncate [&>h2]:pr-12 [&>h2]:font-code [&>h2]:text-sm"
      >
        {state.status === "ready" ? (
          <>
            <a
              href={state.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline flex min-h-[44px] items-center gap-2 self-start text-sm font-semibold text-blue"
            >
              <ExternalLink size={16} aria-hidden="true" /> {t("newTab")}
            </a>
            {state.inPage ? (
              <iframe
                src={state.url}
                title={t("frame", { name })}
                className="min-h-0 w-full flex-1 rounded-[14px] border border-line-soft bg-surface"
              />
            ) : (
              <p className="m-0 text-[15px] text-text-2">{t("noViewer")}</p>
            )}
          </>
        ) : state.status === "failed" ? (
          <FormMessage tone="error">{t("failed")}</FormMessage>
        ) : (
          <p role="status" className="m-0 flex items-center gap-2 text-[15px] text-text-2">
            <Loader2 size={18} aria-hidden="true" className="animate-spin" /> {t("loading")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

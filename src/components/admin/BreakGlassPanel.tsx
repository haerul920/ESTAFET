"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { ReasonAction } from "./ReasonDialog";
import { openBreakGlass } from "@/app/[locale]/admin/actions";
import { SelectField } from "@/components/ui/Field";

interface FileMeta {
  id: string;
  name: string;
  kind: string;
  size_bytes: number;
  stored: boolean;
}

/** Emergency access to ONE private file: reason, re-authentication and a typed confirmation. */
export function BreakGlassPanel({ projectId, files }: { projectId: string; files: FileMeta[] }) {
  const t = useTranslations("admin.bg");
  const router = useRouter();
  const stored = files.filter((f) => f.stored);
  const [fileId, setFileId] = useState(stored[0]?.id ?? "");

  return (
    <section aria-labelledby="bg-h" className="rounded-3xl border-2 border-danger bg-[#fdecea] p-5">
      <h2 id="bg-h" className="m-0 flex items-center gap-2 text-base text-danger">
        <TriangleAlert size={18} aria-hidden="true" /> {t("title")}
      </h2>
      <p className="mb-3 mt-1.5 text-sm text-text-3">{t("intro")}</p>
      {stored.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t("noFiles")}</p>
      ) : (
        <>
          <SelectField
            label={t("fileLabel")}
            value={fileId}
            onValueChange={setFileId}
            className="mb-3"
            options={stored.map((f) => ({
              value: f.id,
              label: t("fileOption", { name: f.name, kind: f.kind, kb: Math.max(1, Math.round(f.size_bytes / 1024)) }),
            }))}
          />
          <ReasonAction
            label={t("open")}
            tone="danger"
            typedPhrase={t("phrase")}
            consequence={
              <ul className="m-0 list-disc pl-5">
                <li>{t("c1")}</li>
                <li>{t("c2")}</li>
                <li>{t("c3")}</li>
                <li>{t("c4")}</li>
              </ul>
            }
            action={(reason) => openBreakGlass(projectId, fileId, reason)}
            successMessage={t("opened")}
            onDone={(data) => {
              const id = data?.accessId;
              if (typeof id === "string") router.push(`/admin/projects/${projectId}/break-glass/${id}`);
            }}
            disabled={!fileId}
          />
        </>
      )}
    </section>
  );
}

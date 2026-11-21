"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { TriangleAlert } from "lucide-react";
import { ReasonAction } from "./ReasonDialog";
import { openBreakGlass } from "@/app/[locale]/admin/actions";

interface FileMeta {
  id: string;
  name: string;
  kind: string;
  size_bytes: number;
  stored: boolean;
}

/** Emergency access to ONE private file: reason, re-authentication and a typed confirmation. */
export function BreakGlassPanel({ projectId, files }: { projectId: string; files: FileMeta[] }) {
  const router = useRouter();
  const stored = files.filter((f) => f.stored);
  const [fileId, setFileId] = useState(stored[0]?.id ?? "");

  return (
    <section aria-labelledby="bg-h" className="rounded-3xl border-2 border-danger bg-[#fdecea] p-5">
      <h2 id="bg-h" className="m-0 flex items-center gap-2 text-base text-danger">
        <TriangleAlert size={18} aria-hidden="true" /> Emergency access to private files
      </h2>
      <p className="mb-3 mt-1.5 text-sm text-text-3">
        Only for legal or safety review. The creators are told, the access expires after 5 minutes, and it is written to the audit log. Admins cannot see private work any other way.
      </p>
      {stored.length === 0 ? (
        <p className="m-0 text-sm text-text-2">This project has no stored private files.</p>
      ) : (
        <>
          <label htmlFor="bg-file" className="mb-1 block text-sm font-semibold">
            File to open (one at a time)
          </label>
          <select id="bg-file" value={fileId} onChange={(e) => setFileId(e.target.value)} className="mb-3 min-h-[44px] w-full rounded-[14px] border border-line-strong bg-white px-3.5">
            {stored.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.kind}, {Math.max(1, Math.round(f.size_bytes / 1024))} KB)
              </option>
            ))}
          </select>
          <ReasonAction
            label="Open private file"
            tone="danger"
            typedPhrase="OPEN PRIVATE FILE"
            consequence={
              <ul className="m-0 list-disc pl-5">
                <li>You get a link to one file that works for 5 minutes.</li>
                <li>The project&apos;s creators receive a notification with your reason.</li>
                <li>A red banner stays visible while you view it.</li>
                <li>The access and your reason are recorded and cannot be removed.</li>
              </ul>
            }
            action={(reason) => openBreakGlass(projectId, fileId, reason)}
            successMessage="Emergency access opened. It expires in 5 minutes."
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

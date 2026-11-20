"use client";

import { ReasonAction } from "./ReasonDialog";
import { purgeDemoData } from "@/app/admin/actions";

export function PurgeControl({ blocked, env }: { blocked: boolean; env: string }) {
  if (blocked) {
    return <p className="m-0 rounded-2xl bg-white p-3 text-sm text-text-2">Purging demo data is disabled in the {env} environment.</p>;
  }
  return (
    <ReasonAction
      label="Purge demo data"
      tone="danger"
      typedPhrase="PURGE DEMO DATA"
      consequence={
        <ul className="m-0 list-disc pl-5">
          <li>Deletes ONLY rows marked demo: demo projects with their files, items, requests and lineage, and demo trial sessions.</li>
          <li>Real (non-demo) projects, users, reports and the audit log are not touched.</li>
          <li>This cannot be undone. Run <code className="font-code">pnpm db:reset</code> to bring the demo data back.</li>
        </ul>
      }
      action={purgeDemoData}
      successMessage="Demo data purged."
    />
  );
}

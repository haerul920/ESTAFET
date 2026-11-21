import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BreakGlassBanner } from "@/components/admin/BreakGlassBanner";
import { KeyValueList, Panel } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/Button";
import { formatWita } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Emergency access" };

export default async function BreakGlassViewPage({ params }: { params: Promise<{ id: string; access: string }> }) {
  const { id, access } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_break_glass_get", { p_access: access });
  const info = data as { file_name: string; kind: string; expires_at: string; project_id: string; reason: string } | null;
  if ((error && !/expired/i.test(error.message)) || (!error && (!info || info.project_id !== id))) notFound();

  if (error || !info) {
    return (
      <Panel title="Emergency access">
        <p role="status" className="mt-0 font-semibold">This emergency access has expired.</p>
        <p className="text-sm text-text-2">Open a new one from the project page if you still need it. Each access needs its own reason.</p>
        <Link href={`/admin/projects/${id}`}>Back to the project</Link>
      </Panel>
    );
  }

  return (
    <>
      <BreakGlassBanner expiresAt={info.expires_at} />
      <div className="pt-10">
        <h1 className="mt-0 text-[26px] font-medium">Emergency access: {info.file_name}</h1>
        <Panel title="This access">
          <KeyValueList items={[{ label: "File", value: <code className="font-code">{info.file_name}</code> }, { label: "Type", value: info.kind }, { label: "Reason", value: info.reason }, { label: "Expires", value: formatWita(info.expires_at) }]} />
          <p className="mb-3 mt-4 text-sm text-text-2">The file opens through a link that works for at most 5 minutes. Do not copy, forward or store its contents unless the review requires it.</p>
          <ButtonLink href={`/api/admin/break-glass/${access}`} prefetch={false} target="_blank" rel="noreferrer" arrow>
            Open the file
          </ButtonLink>
        </Panel>
        <p className="mt-4"><Link href={`/admin/projects/${id}`}>Back to the project</Link></p>
      </div>
    </>
  );
}

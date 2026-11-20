import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageShell, Breadcrumb } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { CreatorVerified, DemoBadge } from "@/components/ui/Badge";
import { RequestForm } from "@/components/features/RequestForm";
import { getTeaserBySlug, getTeaserItems } from "@/lib/db/public";
import { isProjectCreator } from "@/lib/db/access";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Request to continue" };

export default async function RequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/projects/${slug}/request`);
  const project = await getTeaserBySlug(slug);
  if (!project) notFound();
  if (await isProjectCreator(project.id)) redirect(`/projects/${slug}`);

  // One open request per team per project: send them to it.
  const supabase = await createClient();
  const { data: open } = await supabase
    .from("continuation_requests")
    .select("id")
    .eq("project_id", project.id)
    .eq("created_by", user.id)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  if (open) redirect(`/requests/${open.id}`);

  const tasks = (await getTeaserItems(project.id)).filter((i) => i.kind === "next_task");

  return (
    <PageShell>
      <Breadcrumb
        items={[
          { label: "Explore", href: "/explore" },
          { label: project.title, href: `/projects/${slug}` },
          { label: "Request" },
        ]}
      />
      <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">Request to continue this project</h1>
      <p className="mb-8 mt-0 max-w-[640px] text-text-2">
        Tell the original team how you plan to carry it forward. A short, specific plan gets the fastest answer.
      </p>
      <div className="flex flex-wrap items-start gap-8">
        <RequestForm projectId={project.id} slug={slug} tasks={tasks} />
        <aside className="flex min-w-[260px] flex-[0_1_340px] flex-col gap-4">
          <Card>
            <h2 className="mb-2 mt-0 text-lg">{project.title}</h2>
            <p className="mb-3 mt-0 text-sm text-text-2">
              {KIND_LABEL[project.kind]} · {project.year} · {project.field}
            </p>
            <div className="flex flex-wrap gap-2">
              <CreatorVerified />
              {project.is_demo ? <DemoBadge /> : null}
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 mt-0 text-base">What happens next</h2>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {[
                "The creators read your plan and reply here.",
                "If they approve, both sides accept the attribution agreement.",
                "The private files unlock and the handover is logged in the project lineage.",
              ].map((t, i) => (
                <li key={t} className="flex gap-3">
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-semibold ${i === 2 ? "bg-lime text-ink" : "bg-blue text-white"}`}
                  >
                    {i + 1}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}

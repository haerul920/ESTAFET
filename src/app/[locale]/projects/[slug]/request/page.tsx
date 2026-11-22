import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { PageShell, Breadcrumb } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";
import { OwnerVerified, DemoBadge } from "@/components/ui/Badge";
import { RequestForm } from "@/components/features/RequestForm";
import { getTeaserBySlug, getTeaserItems } from "@/lib/db/public";
import { isProjectOwner } from "@/lib/db/access";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLabels } from "@/lib/get-labels";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "reqPage" });
  return { title: tm("metaTitle") };
}

export default async function RequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/projects/${slug}/request`);
  const [locale, t, L, nav] = await Promise.all([
    getLocale(),
    getTranslations("reqPage"),
    getLabels(),
    getTranslations("teaser"),
  ]);
  const project = await getTeaserBySlug(slug);
  if (!project) notFound();
  if (await isProjectOwner(project.id)) redirect({ href: `/projects/${slug}`, locale });
  // Requests exist only in "by request" mode, and only while the team quota has room (CLAUDE.md 14.4).
  const quotaFull = project.max_active_adopters !== null && project.active_adopters >= project.max_active_adopters;
  if (project.access_mode !== "by_request" || quotaFull) redirect({ href: `/projects/${slug}`, locale });

  // One open request per team per project: send them to it.
  const supabase = await createClient();
  const { data: open } = await supabase
    .from("continuation_requests")
    .select("id")
    .eq("project_id", project.id)
    .eq("created_by", user.id)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  if (open) redirect({ href: `/requests/${open.id}`, locale });

  const tasks = (await getTeaserItems(project.id)).filter((i) => i.kind === "next_task");

  return (
    <PageShell>
      <Breadcrumb
        items={[
          { label: nav("explore"), href: "/explore" },
          { label: project.title, href: `/projects/${slug}` },
          { label: t("breadcrumb") },
        ]}
      />
      <h1 className="mb-2 mt-0 text-4xl font-medium max-sm:text-[28px]">{t("title")}</h1>
      <p className="mb-8 mt-0 max-w-[640px] text-text-2">{t("lead")}</p>
      <div className="flex flex-wrap items-start gap-8">
        <RequestForm projectId={project.id} slug={slug} tasks={tasks} />
        <aside className="flex min-w-[260px] flex-[0_1_340px] flex-col gap-4">
          <Card>
            <h2 className="mb-2 mt-0 text-lg">{project.title}</h2>
            <p className="mb-3 mt-0 text-sm text-text-2">
              {L.kind[project.kind]} · {project.year} · {L.faculty(project.field)}
            </p>
            <div className="flex flex-wrap gap-2">
              <OwnerVerified />
              {project.is_demo ? <DemoBadge /> : null}
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 mt-0 text-base">{t("next")}</h2>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {[t("n1"), t("n2"), t("n3")].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-semibold ${i === 2 ? "bg-lime text-ink" : "bg-blue text-white"}`}
                  >
                    {i + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}

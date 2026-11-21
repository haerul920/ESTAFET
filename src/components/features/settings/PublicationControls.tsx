"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { archiveProject, republishProject, unpublishProject } from "@/app/actions/owner";
import type { ProjectStatus } from "@/lib/db/types";

const TONE = { draft: "info", published: "ok", unpublished: "warn", archived: "neutral" } as const;

/** Publication state with a plain explanation, and the actions that are allowed in that state. One clear action per state. */
export function PublicationControls({
  projectId,
  slug,
  status,
  moderated,
  resumeHref,
}: {
  projectId: string;
  slug: string;
  status: ProjectStatus;
  moderated: boolean;
  resumeHref: string;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <Card as="section" aria-labelledby="pub-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="pub-h" className="m-0 text-xl">
          {t("pub.title")}
        </h2>
        <Badge tone={TONE[status]}>{t(`pub.${status}`)}</Badge>
      </div>
      <p className="m-0 text-[15px] text-text-3">{t(`pub.${status}Text`)}</p>
      {moderated ? <p className="m-0 rounded-[14px] bg-warn-bg p-3 text-sm text-warn-ink">{t("pub.moderated")}</p> : null}

      <div className="flex flex-wrap gap-3">
        {status === "draft" ? (
          <ButtonLink href={resumeHref} arrow>
            {t("continueWizard")}
          </ButtonLink>
        ) : null}
        {status === "published" ? (
          <>
            <ButtonLink href={`/projects/${slug}`} variant="outline">
              {t("viewPublic")}
            </ButtonLink>
            <ConfirmDialog
              trigger={t("pub.unpublish")}
              title={t("pub.unpublishTitle")}
              effect={t("pub.unpublishEffect")}
              confirmLabel={t("confirm")}
              onConfirm={() => unpublishProject(projectId)}
              onDone={refresh}
            />
          </>
        ) : null}
        {status === "unpublished" ? (
          <ConfirmDialog
            trigger={t("pub.republish")}
            title={t("pub.republishTitle")}
            effect={t("pub.republishEffect")}
            confirmLabel={t("confirm")}
            triggerVariant="primary"
            onConfirm={() => republishProject(projectId)}
            onDone={refresh}
          />
        ) : null}
        {status === "published" || status === "unpublished" ? (
          <ConfirmDialog
            trigger={t("pub.archive")}
            title={t("pub.archiveTitle")}
            effect={t("pub.archiveEffect")}
            confirmLabel={t("confirmArchive")}
            tone="danger"
            triggerVariant="danger"
            onConfirm={() => archiveProject(projectId)}
            onDone={refresh}
          />
        ) : null}
      </div>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { BookOpen, Flag, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/Menu";
import { ReportDialog } from "./ReportDialog";

/** The "..." menu of a project page. It holds the report entry and the link to the community guidelines. */
export function ProjectMenu({ projectId, signedIn }: { projectId: string; signedIn: boolean }) {
  const t = useTranslations("report");
  const [reporting, setReporting] = useState(false);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={t("menu")}
            className="icon-btn flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-line bg-white text-ink hover:bg-surface"
          >
            <MoreHorizontal size={20} aria-hidden="true" />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => setReporting(true)}>
            <Flag size={18} aria-hidden="true" /> {t("open")}
          </MenuItem>
          <MenuItem asChild>
            <Link href="/pedoman">
              <BookOpen size={18} aria-hidden="true" /> {t("guidelinesLink")}
            </Link>
          </MenuItem>
        </MenuContent>
      </Menu>
      <ReportDialog
        projectId={projectId}
        signedIn={signedIn}
        open={reporting}
        onOpenChange={setReporting}
        hideTrigger
      />
    </>
  );
}

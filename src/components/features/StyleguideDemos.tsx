"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/Menu";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { useToast } from "@/components/ui/Toast";
import { Tip } from "@/components/ui/Tooltip";

/** The interactive part of `/styleguide`: tabs, dialog, drawer, menu, tooltip and toasts, all on the shared UI kit. */
export function StyleguideDemos() {
  const t = useTranslations("styleguide.interactive");
  const toast = useToast();
  const [tab, setTab] = useState("one");

  return (
    <div className="flex flex-col gap-6">
      <SegmentedTabs
        label={t("tabsLabel")}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "one", label: t("tabOne"), count: 3 },
          { id: "two", label: t("tabTwo") },
        ]}
      >
        <p className="m-0 text-text-2">{tab === "one" ? t("panelOne") : t("panelTwo")}</p>
      </SegmentedTabs>

      <div className="flex flex-wrap items-center gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t("openDialog")}</Button>
          </DialogTrigger>
          <DialogContent title={t("dialogTitle")} description={t("dialogText")}>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <DialogClose asChild>
                <Button variant="outline">{t("cancel")}</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="primary">{t("confirm")}</Button>
              </DialogClose>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t("openDrawer")}</Button>
          </DialogTrigger>
          <DialogContent variant="drawer" title={t("drawerTitle")} description={t("drawerText")}>
            <DialogClose asChild>
              <Button variant="outline" className="mt-5">
                {t("cancel")}
              </Button>
            </DialogClose>
          </DialogContent>
        </Dialog>

        <Menu>
          <MenuTrigger asChild>
            <Button variant="outline">
              {t("openMenu")}
              <ChevronDown size={16} aria-hidden="true" />
            </Button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuLabel>{t("menuLabel")}</MenuLabel>
            <MenuItem onSelect={() => toast.push({ message: t("menuPicked", { item: t("menuOne") }) })}>
              {t("menuOne")}
            </MenuItem>
            <MenuItem onSelect={() => toast.push({ message: t("menuPicked", { item: t("menuTwo") }) })}>
              {t("menuTwo")}
            </MenuItem>
          </MenuContent>
        </Menu>

        <Tip label={t("tooltipText")}>
          <button
            type="button"
            aria-label={t("tooltipTrigger")}
            className="icon-btn flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-surface"
          >
            <Info size={20} aria-hidden="true" />
          </button>
        </Tip>

        <Button variant="outlineBlue" onClick={() => toast.push({ message: t("toastSaved"), undo: async () => ({}) })}>
          {t("toastSuccess")}
        </Button>
        <Button variant="danger" onClick={() => toast.push({ message: t("toastFailed"), tone: "error" })}>
          {t("toastError")}
        </Button>
      </div>
    </div>
  );
}

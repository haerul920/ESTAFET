"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

/** Asks before leaving when something would not be kept. */
export function LeaveDialog({
  open,
  onOpenChange,
  title,
  text,
  onLeave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text: string;
  onLeave: () => void;
}) {
  const t = useTranslations("saveExit");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} showClose={false}>
        <p className="mb-0 mt-3 text-[15px] text-text-3">{text}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("stay")}
          </Button>
          <Button variant="darkSolid" onClick={onLeave}>
            {t("leave")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Save and exit" for the wizard steps that save as you go. A part of the page with changes that are not saved yet
 * marks itself with `data-unsaved="true"`, and then the button asks before leaving.
 */
export function SaveExitButton() {
  const t = useTranslations("saveExit");
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [leaving, startLeaving] = useTransition();
  const leave = () => startLeaving(() => router.push("/dasbor"));

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        loading={leaving}
        onClick={() => (document.querySelector('main [data-unsaved="true"]') ? setAsking(true) : leave())}
      >
        {t("button")}
      </Button>
      <LeaveDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("unsavedTitle")}
        text={t("unsavedText")}
        onLeave={() => {
          setAsking(false);
          leave();
        }}
      />
    </>
  );
}

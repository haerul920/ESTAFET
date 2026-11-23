"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormMessage } from "@/components/ui/Field";
import { cancelAccountDeletion, requestAccountDeletion } from "@/app/actions/account";

/** Schedule or cancel the deletion of the account. Scheduling asks for confirmation and says what happens. */
export function DeletionControls({ scheduled }: { scheduled: boolean }) {
  const t = useTranslations("account.delete");
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (scheduled) {
    return (
      <div className="flex flex-col gap-2">
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <div>
          <Button
            variant="outlineBlue"
            pending={pending}
            onClick={() =>
              start(async () => {
                const r = await cancelAccountDeletion();
                if (r.error) setError(r.error);
                else router.refresh();
              })
            }
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ConfirmDialog
      trigger={t("request")}
      title={t("confirmTitle")}
      effect={t("confirmEffect")}
      confirmLabel={t("confirm")}
      tone="danger"
      triggerVariant="danger"
      onConfirm={requestAccountDeletion}
      onDone={() => router.refresh()}
    />
  );
}

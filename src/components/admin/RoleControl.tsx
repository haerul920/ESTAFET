"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ReasonAction } from "./ReasonDialog";
import { StatusPill } from "./ui";
import { setUserRole } from "@/app/[locale]/admin/actions";

/**
 * The role in the users table, with the button that changes it. It asks for a reason and the password, and the change
 * is audited. Nobody can change their own role; the database refuses it too.
 */
export function RoleControl({
  userId,
  name,
  isAdmin,
  self,
}: {
  userId: string;
  name: string;
  isAdmin: boolean;
  self: boolean;
}) {
  const t = useTranslations("admin.users");
  const router = useRouter();
  return (
    <span className="flex flex-wrap items-center gap-2">
      {isAdmin ? <StatusPill tone="info">{t("roleAdmin")}</StatusPill> : <span>{t("roleMember")}</span>}
      {self ? (
        <span className="text-[13px] text-text-2">{t("you")}</span>
      ) : (
        <ReasonAction
          small
          label={isAdmin ? t("makeMember") : t("makeAdmin")}
          tone={isAdmin ? "danger" : "outline"}
          consequence={isAdmin ? t("makeMemberEffect", { name }) : t("makeAdminEffect", { name })}
          action={setUserRole.bind(null, userId, !isAdmin)}
          successMessage={t("roleChanged", { name })}
          onDone={() => router.refresh()}
        />
      )}
    </span>
  );
}

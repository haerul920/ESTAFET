import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/labels";

export const metadata: Metadata = { title: "Account suspended", robots: { index: false } };

export default async function SuspendedPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const contact = settings.contact_email.value;
  const until = user?.profile?.suspended_until;
  return (
    <PageShell width={620}>
      <div role="alert" className="flex flex-col items-center gap-3 rounded-[28px] bg-warn-bg p-10 text-center">
        <ShieldAlert size={40} className="text-warn" aria-hidden="true" />
        <h1 className="m-0 text-[30px] font-medium">Your account is suspended</h1>
        <p className="m-0 text-warn-ink">
          {until ? `The suspension ends on ${formatDate(until)}. ` : ""}
          While it lasts you cannot share projects, send requests or open private files. Public pages stay open.
        </p>
        {user?.profile?.suspended_reason ? <p className="m-0 text-sm text-warn-ink">Reason: {user.profile.suspended_reason}</p> : null}
        <p className="m-0 text-warn-ink">
          {contact ? (
            <>
              To ask about this, write to <a href={`mailto:${contact}`}>{contact}</a>.
            </>
          ) : (
            "To ask about this, contact the ESTAFET team (team Beban Server)."
          )}
        </p>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </PageShell>
  );
}

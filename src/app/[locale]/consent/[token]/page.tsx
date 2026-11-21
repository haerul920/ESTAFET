import type { Metadata } from "next";
import { Clock, LinkIcon, ShieldAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { loadConsent } from "@/lib/db/consent";
import { ConsentDecision } from "@/components/features/ConsentDecision";
import { DemoBadge } from "@/components/ui/Badge";
import { Logo } from "@/components/ui/Logo";
import { Cloud } from "@/components/ui/motion";
import { formatDate } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tm = await getTranslations({ locale, namespace: "advisor" });
  return { title: tm("metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-[560px] bg-white">
      <header className="relative overflow-hidden px-4 pb-14 pt-4" style={{ background: "linear-gradient(180deg,#2F8CF0 0%,#7DBBF7 60%,#FFFFFF 100%)" }}>
        <Cloud className="-left-10 top-10 h-[70px] w-[200px] opacity-55 blur-[20px]" drift={16} />
        <div className="glass glass-strong relative flex items-center gap-2.5 rounded-full px-[18px] py-2.5">
          <Logo size={28} />
        </div>
      </header>
      <main id="main" className="flex flex-col gap-4 px-4 pb-10">
        {children}
      </main>
    </div>
  );
}

function Notice({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Shell>
      <div role="status" className="flex flex-col items-center gap-3 rounded-3xl bg-surface p-8 text-center">
        {icon}
        <h1 className="m-0 text-[26px] font-medium">{title}</h1>
        <p className="m-0 text-text-2">{text}</p>
      </div>
    </Shell>
  );
}

export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [locale, t] = await Promise.all([getLocale(), getTranslations("advisor")]);
  const consent = await loadConsent(token);

  if (consent.state === "invalid") {
    return <Notice icon={<LinkIcon size={40} className="text-text-2" aria-hidden="true" />} title={t("invalidTitle")} text={t("invalidText")} />;
  }
  if (consent.state === "rate_limited") {
    return <Notice icon={<ShieldAlert size={40} className="text-warn" aria-hidden="true" />} title={t("rateTitle")} text={t("rateText")} />;
  }
  if (consent.state === "expired") {
    return <Notice icon={<Clock size={40} className="text-warn" aria-hidden="true" />} title={t("expiredTitle")} text={t("expiredText")} />;
  }

  const { project, state } = consent;
  const decided = state !== "pending";
  const when = consent.decidedAt ? formatDate(consent.decidedAt, locale) : "";

  return (
    <Shell>
      <div>
        <div className="mono-label mb-2.5 text-text-2">{t("eyebrow")}</div>
        <h1 className="m-0 text-[32px] font-medium leading-[1.1] tracking-[-0.04em]">{t("heading")}</h1>
      </div>

      <section className="flex flex-col gap-2 rounded-3xl bg-surface p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="m-0 text-[19px] font-semibold">{project.title}</h2>
          {project.is_demo ? <DemoBadge /> : null}
        </div>
        <span className="text-[15px] text-text-2">{t("sharedBy", { name: project.sharedBy, advisor: project.advisorName || t("advisorNone") })}</span>
        {project.summary ? <p className="m-0 text-[15px] text-text-3">{project.summary}</p> : null}
      </section>

      <section className="rounded-3xl bg-blue-tint p-5">
        <h2 className="mb-2 mt-0 text-[17px] font-semibold">{t("publicTitle")}</h2>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[15px] text-text-3">
          <li>{t("p1")}</li>
          <li>{t("p2")}</li>
          <li>{t("p3")}</li>
          <li>{t("p4")}</li>
        </ul>
      </section>

      <section className="rounded-3xl bg-surface p-5">
        <h2 className="mb-2 mt-0 text-[17px] font-semibold">{t("privateTitle")}</h2>
        <p className="m-0 text-[15px] text-text-3">{t("privateText")}</p>
      </section>

      <section className="rounded-3xl bg-surface p-5">
        <h2 className="mb-2 mt-0 text-[17px] font-semibold">{t("nameTitle")}</h2>
        <p className="m-0 text-[15px] text-text-3">{t("nameText")}</p>
      </section>

      {decided ? (
        <section role="status" className="rounded-3xl bg-warn-bg p-5 text-warn-ink">
          <strong>
            {state === "approved"
              ? when
                ? t("approvedOn", { date: when })
                : t("approvedNoDate")
              : state === "declined"
                ? when
                  ? t("declinedOn", { date: when })
                  : t("declinedNoDate")
                : t("withdrawnText")}
          </strong>{" "}
          {t("oneDecision")}
        </section>
      ) : null}

      {state === "pending" ? <ConsentDecision token={token} /> : null}
      {state === "approved" ? <ConsentDecision token={token} canWithdraw /> : null}

      <p className="m-0 text-[13px] text-text-2">
        {t("footer")}
        {state === "pending" || state === "approved" ? t("footerWithdraw") : ""}
      </p>
    </Shell>
  );
}

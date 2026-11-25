import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument, legalMetadata } from "@/components/features/LegalDocument";
import { Card } from "@/components/ui/Card";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return legalMetadata((await params).locale, "contact");
}

/** Contact page. The address comes from the admin setting `contact_email`. */
export default async function ContactPage() {
  const [t, settings] = await Promise.all([getTranslations("legal.contact"), getSettings()]);
  const email = settings.contact_email.value;
  return (
    <LegalDocument doc="contact">
      <Card className="flex flex-col gap-2">
        {email ? (
          <p className="m-0">
            <strong>{t("emailLabel")}:</strong>{" "}
            <a href={`mailto:${email}`} className="link-anim font-semibold text-blue">
              {email}
            </a>
          </p>
        ) : (
          <p className="m-0">{t("noEmail")}</p>
        )}
      </Card>
      <section aria-labelledby="contact-include">
        <h2 id="contact-include" className="mb-1 mt-0 text-xl">
          {t("includeTitle")}
        </h2>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
          <li>{t("include1")}</li>
          <li>{t("include2")}</li>
          <li>{t("include3")}</li>
        </ul>
      </section>
      <section aria-labelledby="contact-report">
        <h2 id="contact-report" className="mb-1 mt-0 text-xl">
          {t("reportTitle")}
        </h2>
        <p className="m-0">{t("reportText")}</p>
      </section>
    </LegalDocument>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isProduction } from "@/lib/admin/env";
import { PageShell } from "@/components/ui/PageShell";
import { Badge, Chip, DemoBadge, EvidenceChip, OwnerVerified } from "@/components/ui/Badge";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxField, FormMessage, SelectField, TextArea, TextField } from "@/components/ui/Field";
import { Stepper } from "@/components/ui/Stepper";
import { StyleguideDemos } from "@/components/features/StyleguideDemos";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "styleguide" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** Design tokens from `src/styles/tokens.css`, shown as swatches. */
const COLORS: { token: string; hex: string }[] = [
  { token: "--ink", hex: "#0E1A26" },
  { token: "--black", hex: "#10151A" },
  { token: "--blue", hex: "#1760D6" },
  { token: "--blue-dark", hex: "#0F4BAA" },
  { token: "--blue-tint", hex: "#E6F0FE" },
  { token: "--lime", hex: "#CDF54B" },
  { token: "--surface", hex: "#F3F4F6" },
  { token: "--surface-grey", hex: "#EFEFEF" },
  { token: "--chip", hex: "#E1E5E9" },
  { token: "--border", hex: "#DDE1E5" },
  { token: "--border-strong", hex: "#8A979F" },
  { token: "--text-2", hex: "#4A5A66" },
  { token: "--success-fg", hex: "#165C39" },
  { token: "--success-bg", hex: "#E4F3EA" },
  { token: "--warning-fg", hex: "#7A4A00" },
  { token: "--warning-bg", hex: "#FDF1DC" },
  { token: "--danger", hex: "#B3261E" },
];

const GRADIENTS = ["--sky-gradient", "--sky-strip", "--meadow-sky"];

const LAYERS: [string, number][] = [
  ["--z-base", 0],
  ["--z-raised", 10],
  ["--z-sticky", 20],
  ["--z-nav", 30],
  ["--z-dropdown", 40],
  ["--z-drawer", 50],
  ["--z-overlay", 60],
  ["--z-modal", 70],
  ["--z-toast", 80],
  ["--z-system-banner", 90],
];

const MOTION: [string, string][] = [
  ["--dur-micro", "150ms"],
  ["--dur-std", "250ms"],
  ["--dur-reveal", "500ms"],
  ["--ease", "cubic-bezier(0.22, 1, 0.36, 1)"],
];

const LIGHT_VARIANTS: ButtonVariant[] = ["primary", "darkSolid", "outline", "outlineBlue", "danger", "ghost"];
const SKY_VARIANTS: ButtonVariant[] = ["dark", "white"];
const BADGE_TONES = ["ok", "info", "warn", "neutral", "danger", "lime"] as const;
const CARD_TONES = ["surface", "white", "lime", "blue", "warn", "grey", "dashed"] as const;
const TECH = ["Next.js", "Supabase", "Python"];
const SAMPLE_FILE = "laporan-akhir-2025.pdf";

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex scroll-mt-24 flex-col gap-4 border-t border-line pt-8">
      <div>
        <h2 id={id} className="m-0 text-2xl font-medium tracking-[-0.02em]">
          {title}
        </h2>
        {lead ? <p className="mb-0 mt-1 max-w-[680px] text-text-2">{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

const code = "font-code text-[13px] text-text-3";

/**
 * Internal styleguide: every token and UI kit component in one place, to compare against the approved design.
 * Not linked from the navigation, `noindex`, and a 404 in PRODUCTION (like `/api/dev/email-preview`).
 */
export default async function StyleguidePage() {
  if (isProduction()) notFound();
  const t = await getTranslations("styleguide");

  return (
    <PageShell>
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <p className="mono-label m-0 text-[12.5px] uppercase text-text-2">{t("eyebrow")}</p>
          <h1 className="m-0 text-5xl font-medium tracking-[-0.04em] max-sm:text-[34px]">{t("title")}</h1>
          <p className="m-0 max-w-[680px] text-lg text-text-2">{t("lead")}</p>
          <FormMessage tone="success">{t("notice")}</FormMessage>
        </header>

        <Section id="sg-colors" title={t("colors.title")} lead={t("colors.lead")}>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-0">
            {COLORS.map((c) => (
              <li key={c.token} className="overflow-hidden rounded-[20px] border border-line bg-white">
                <div
                  className="h-16 border-b border-line"
                  style={{ background: `var(${c.token})` }}
                  aria-hidden="true"
                />
                <div className="flex flex-col px-3 py-2">
                  <span className={code}>{c.token}</span>
                  <span className="text-[13px] text-text-2">{c.hex}</span>
                </div>
              </li>
            ))}
          </ul>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-0">
            {GRADIENTS.map((g) => (
              <li key={g} className="overflow-hidden rounded-[20px] border border-line bg-white">
                <div className="h-24" style={{ background: `var(${g})` }} aria-hidden="true" />
                <span className={`${code} block px-3 py-2`}>{g}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="sg-type" title={t("type.title")} lead={t("type.lead")}>
          <Card tone="white" className="flex flex-col gap-4">
            <p className="m-0 text-5xl font-medium tracking-[-0.04em] max-sm:text-[34px]">{t("type.display")}</p>
            <p className="m-0 text-2xl font-medium tracking-[-0.02em]">{t("type.heading")}</p>
            <p className="m-0 max-w-[620px] text-base">{t("type.body")}</p>
            <p className="m-0 text-sm text-text-2">{t("type.secondary")}</p>
            <p className="mono-label m-0 text-[12.5px] uppercase">{t("type.label")}</p>
            <p className="m-0">
              <span className="font-code text-sm">{SAMPLE_FILE}</span>{" "}
              <span className="text-sm text-text-2">{t("type.code")}</span>
            </p>
          </Card>
        </Section>

        <Section id="sg-buttons" title={t("buttons.title")} lead={t("buttons.lead")}>
          <div className="flex flex-wrap items-center gap-3">
            {LIGHT_VARIANTS.map((v) => (
              <Button key={v} variant={v} arrow={v === "primary" || v === "darkSolid"}>
                {t(`buttons.v.${v}`)}
              </Button>
            ))}
          </div>
          <div
            className="flex flex-wrap items-center gap-3 rounded-[28px] p-6"
            style={{ background: "var(--sky-gradient)" }}
          >
            {SKY_VARIANTS.map((v) => (
              <Button key={v} variant={v}>
                {t(`buttons.v.${v}`)}
              </Button>
            ))}
            <Button variant="primary" size="lg" arrow glow>
              {t("buttons.hero")}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" arrow>
              {t("buttons.small")}
            </Button>
            <Button size="md">{t("buttons.medium")}</Button>
            <Button size="lg" arrow>
              {t("buttons.large")}
            </Button>
            <Button disabled>{t("buttons.disabled")}</Button>
          </div>
        </Section>

        <Section id="sg-badges" title={t("badges.title")} lead={t("badges.lead")}>
          <div className="flex flex-wrap items-center gap-2">
            {BADGE_TONES.map((tone) => (
              <Badge key={tone} tone={tone}>
                {t(`badges.tone.${tone}`)}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OwnerVerified />
            <DemoBadge />
            <EvidenceChip status="matched" detail={t("badges.evidenceDetail", { file: SAMPLE_FILE, page: 4 })} />
            <EvidenceChip status="partial" />
            <EvidenceChip status="not_found" />
            {TECH.map((x) => (
              <Chip key={x}>{x}</Chip>
            ))}
          </div>
        </Section>

        <Section id="sg-cards" title={t("cards.title")} lead={t("cards.lead")}>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 p-0">
            {CARD_TONES.map((tone) => (
              <Card key={tone} as="li" tone={tone} className="flex flex-col gap-1">
                <span className={code}>{tone}</span>
                <span className="text-sm">{t(`cards.tone.${tone}`)}</span>
              </Card>
            ))}
          </ul>
        </Section>

        <Section id="sg-fields" title={t("fields.title")} lead={t("fields.lead")}>
          <Card tone="white" className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
            <TextField
              label={t("fields.title1")}
              hint={t("fields.title1Hint")}
              defaultValue={t("fields.title1Value")}
            />
            <TextField
              label={t("fields.email")}
              type="email"
              defaultValue="nama@"
              error={t("fields.emailError")}
              autoComplete="off"
            />
            <SelectField
              label={t("fields.kind")}
              defaultValue="hackathon"
              options={[
                { value: "student_program", label: t("fields.kindA") },
                { value: "hackathon", label: t("fields.kindB") },
                { value: "research", label: t("fields.kindC") },
              ]}
            />
            <TextField label={t("fields.disabled")} disabled defaultValue={t("fields.disabledValue")} />
            <TextArea label={t("fields.notes")} hint={t("fields.notesHint")} className="col-span-full" />
            <CheckboxField label={t("fields.check")} className="col-span-full" />
            <div className="col-span-full flex flex-col gap-3">
              <FormMessage tone="success">{t("fields.success")}</FormMessage>
              <FormMessage tone="error">{t("fields.error")}</FormMessage>
            </div>
          </Card>
        </Section>

        <Section id="sg-stepper" title={t("stepper.title")} lead={t("stepper.lead")}>
          <Stepper
            label={t("stepper.label")}
            current={2}
            steps={[
              { label: t("stepper.s1") },
              { label: t("stepper.s2") },
              { label: t("stepper.s3") },
              { label: t("stepper.s4") },
              { label: t("stepper.s5") },
            ]}
          />
        </Section>

        <Section id="sg-interactive" title={t("interactive.title")} lead={t("interactive.lead")}>
          <StyleguideDemos />
        </Section>

        <Section id="sg-layers" title={t("layers.title")} lead={t("layers.lead")}>
          <TokenTable caption={t("layers.title")} head={[t("tokenCol"), t("valueCol")]} rows={LAYERS} />
        </Section>

        <Section id="sg-motion" title={t("motion.title")} lead={t("motion.lead")}>
          <TokenTable caption={t("motion.title")} head={[t("tokenCol"), t("valueCol")]} rows={MOTION} />
        </Section>
      </div>
    </PageShell>
  );
}

function TokenTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: [string, string];
  rows: [string, string | number][];
}) {
  return (
    <div className="overflow-x-auto rounded-[20px] border border-line">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface">
          <tr>
            <th scope="col" className="px-4 py-2 font-semibold">
              {head[0]}
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              {head[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([token, value]) => (
            <tr key={token} className="border-t border-line">
              <td className={`${code} px-4 py-2`}>{token}</td>
              <td className="px-4 py-2">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

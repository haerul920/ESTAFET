import { useTranslations } from "next-intl";
import { PageShell } from "./PageShell";
import { BreadcrumbBar, FieldShape, StepperBar, TextLines } from "./skeleton-shapes";
import { WizardBasicsSkeleton, WizardStepSkeleton } from "./WizardSkeleton";

export type SkeletonVariant =
  | "list"
  | "detail"
  | "form"
  | "document"
  | "teaser"
  | "workspace"
  | "requestForm"
  | "requestReview"
  | "wizardBasics"
  | "wizardStep"
  | "projectSettings"
  | "decision"
  | "accountPrivacy"
  | "policyGate"
  | "myReports"
  | "start"
  | "login"
  | "signup"
  | "legal"
  | "contact"
  | "suspended"
  | "styleguide";

const WIDTH_BY_VARIANT: Partial<Record<SkeletonVariant, number>> = {
  login: 520,
  signup: 520,
  suspended: 620,
  policyGate: 680,
  legal: 760,
  contact: 760,
  document: 760,
  decision: 820,
  workspace: 920,
  accountPrivacy: 820,
  myReports: 820,
  form: 820,
  wizardBasics: 1040,
  wizardStep: 1040,
  start: 880,
  projectSettings: 880,
};

/**
 * Route-specific loading skeletons used by `loading.tsx` boundaries across the app.
 * Every variant mirrors the real page container width, header, cards, sidebars, and controls
 * so transitions have zero layout shift when server content streams in.
 */
export function PageSkeleton({ variant = "list", width }: { variant?: SkeletonVariant; width?: number }) {
  const t = useTranslations("common");
  const resolvedWidth = width ?? WIDTH_BY_VARIANT[variant];

  return (
    <PageShell width={resolvedWidth}>
      <div role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t("loadingPage")}</span>
        <div aria-hidden="true">
          {variant === "teaser" || variant === "detail" ? <TeaserSkeleton /> : null}
          {variant === "workspace" ? <WorkspaceSkeleton /> : null}
          {variant === "requestForm" ? <RequestFormSkeleton /> : null}
          {variant === "requestReview" ? <RequestReviewSkeleton /> : null}
          {variant === "wizardBasics" ? <WizardBasicsSkeleton /> : null}
          {variant === "wizardStep" ? <WizardStepSkeleton /> : null}
          {variant === "projectSettings" ? <ProjectSettingsSkeleton /> : null}
          {variant === "decision" ? <DecisionSkeleton /> : null}
          {variant === "accountPrivacy" ? <AccountPrivacySkeleton /> : null}
          {variant === "policyGate" ? <PolicyGateSkeleton /> : null}
          {variant === "myReports" ? <MyReportsSkeleton /> : null}
          {variant === "start" ? <StartSkeleton /> : null}
          {variant === "login" ? <AuthSkeleton mode="login" /> : null}
          {variant === "signup" || variant === "form" ? <AuthSkeleton mode="signup" /> : null}
          {variant === "legal" || variant === "document" ? <LegalSkeleton /> : null}
          {variant === "contact" ? <ContactSkeleton /> : null}
          {variant === "suspended" ? <SuspendedSkeleton /> : null}
          {variant === "styleguide" ? <StyleguideSkeleton /> : null}
          {variant === "list" ? <MyReportsSkeleton /> : null}
        </div>
      </div>
    </PageShell>
  );
}

/** Public project page `/projects/[slug]`: one column. */
function TeaserSkeleton() {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="skeleton h-4 w-64 max-w-full rounded-full" />
        <div className="flex gap-2">
          <div className="skeleton h-11 w-28 rounded-full" />
          <div className="skeleton h-11 w-40 rounded-full" />
        </div>
      </div>
      <div className="mb-8">
        <div className="skeleton mb-4 h-11 w-[min(520px,90%)] rounded-2xl" />
        <div className="skeleton h-4 w-[min(680px,95%)] rounded-full" />
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-6 w-52" />
          <TextLines widths={["w-full", "w-[94%]", "w-[40%]"]} />
        </div>
        <div className="flex flex-col gap-3 rounded-[28px] bg-warn-bg p-6">
          <div className="skeleton-strong h-6 w-40" />
          <TextLines widths={["w-[82%]"]} />
        </div>
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-6 w-80 max-w-full" />
          <TextLines widths={["w-[86%]"]} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-[18px] border border-line-soft bg-white p-4">
              <div className="skeleton h-5 w-[62%]" />
              <div className="skeleton h-4 w-[78%]" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-6 w-48" />
          <TextLines widths={["w-[90%]", "w-[74%]"]} />
        </div>
      </div>
    </>
  );
}

/** Private workspace `/projects/[slug]/workspace` */
function WorkspaceSkeleton() {
  return (
    <>
      <BreadcrumbBar parts={3} />
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-2.5">
          <div className="skeleton h-7 w-44 rounded-full" />
          <div className="skeleton h-10 w-[min(420px,90%)] rounded-2xl" />
          <div className="skeleton h-5 w-[min(420px,80%)] rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <div className="skeleton h-11 w-36 rounded-full" />
          <div className="skeleton h-11 w-40 rounded-full" />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-6 w-48" />
          <div className="skeleton-strong mb-2 h-4 w-72 max-w-full" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-[18px] border border-line-soft bg-white p-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="skeleton h-5 w-5 rounded-md" />
                <div className="skeleton h-4 w-48" />
              </div>
              <div className="skeleton h-10 w-28 rounded-full" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-6 w-56" />
          <div className="skeleton-strong mb-2 h-4 w-80 max-w-full" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-[18px] border border-line-soft bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="skeleton h-5 w-64 max-w-[70%]" />
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
              <div className="skeleton h-4 w-[88%]" />
              <div className="flex gap-2">
                <div className="skeleton h-8 w-24 rounded-full" />
                <div className="skeleton h-8 w-28 rounded-full" />
                <div className="skeleton h-8 w-24 rounded-full" />
              </div>
              <div className="flex flex-col gap-2 rounded-[14px] bg-surface p-3">
                <div className="skeleton-strong h-3.5 w-[92%]" />
                <div className="skeleton-strong h-3 w-40" />
                <div className="skeleton-strong h-6 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** Continuation request form `/projects/[slug]/request` */
function RequestFormSkeleton() {
  return (
    <>
      <BreadcrumbBar parts={3} />
      <div className="skeleton mb-2 h-10 w-80 max-w-full rounded-2xl" />
      <div className="skeleton mb-8 h-5 w-[min(560px,90%)] rounded-full" />
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-5 rounded-[28px] bg-surface p-6">
          <div className="flex flex-col gap-2">
            <div className="skeleton-strong h-4 w-32" />
            <div className="skeleton-strong h-12 w-full rounded-[14px]" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="skeleton-strong h-4 w-44" />
            <div className="skeleton-strong h-12 w-full rounded-[14px]" />
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="skeleton-strong h-4 w-52" />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-[14px] border border-line-soft bg-white px-4 py-3"
              >
                <div className="skeleton h-5 w-5 rounded-md" />
                <div className="skeleton h-4 w-[75%]" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <div className="skeleton-strong h-4 w-40" />
            <div className="skeleton-strong h-28 w-full rounded-[14px]" />
          </div>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div className="skeleton-strong h-12 w-full rounded-[14px]" />
            <div className="skeleton-strong h-12 w-full rounded-[14px]" />
          </div>
          <div className="skeleton-strong h-12 w-48 rounded-full" />
        </div>

        <aside className="flex min-w-[260px] flex-[0_1_340px] flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
            <div className="skeleton-strong h-6 w-48" />
            <div className="skeleton-strong h-4 w-40" />
            <div className="flex gap-2">
              <div className="skeleton-strong h-6 w-32 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-[28px] bg-surface p-6">
            <div className="skeleton-strong h-5 w-44" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton-strong h-6 w-6 flex-none rounded-full" />
                <div className="skeleton-strong h-4 w-full" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}

/** Continuation request review `/requests/[id]` */
function RequestReviewSkeleton() {
  return (
    <>
      <BreadcrumbBar parts={2} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-10 w-80 max-w-full rounded-2xl" />
          <div className="skeleton h-5 w-96 max-w-full rounded-full" />
        </div>
        <div className="skeleton h-7 w-32 rounded-full" />
      </div>
      <StepperBar steps={4} current={2} />
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-[28px] bg-surface p-6">
            <div className="skeleton-strong h-7 w-48" />
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-strong h-9 w-9 rounded-full" />
              ))}
              <div className="skeleton-strong h-4 w-28 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="skeleton-strong h-7 w-36 rounded-full" />
              <div className="skeleton-strong h-7 w-40 rounded-full" />
            </div>
            <div className="skeleton-strong h-16 w-full rounded-[14px]" />
            <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
              <div className="skeleton-strong h-10 rounded-xl" />
              <div className="skeleton-strong h-10 rounded-xl" />
              <div className="skeleton-strong h-10 rounded-xl" />
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
            <div className="skeleton-strong h-6 w-44" />
            <div className="skeleton-strong h-4 w-[85%]" />
            <div className="flex gap-3">
              <div className="skeleton-strong h-11 w-36 rounded-full" />
              <div className="skeleton-strong h-11 w-32 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
            <div className="skeleton-strong h-6 w-40" />
            <div className="skeleton-strong h-20 w-full rounded-2xl" />
            <div className="skeleton-strong h-24 w-full rounded-[14px]" />
            <div className="skeleton-strong h-11 w-36 rounded-full" />
          </div>
        </div>
        <aside className="flex min-w-[280px] flex-[0_1_400px] flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[28px] border-2 border-lime bg-white p-6">
            <div className="skeleton h-6 w-48" />
            <TextLines strong={false} widths={["w-full", "w-[90%]", "w-[96%]", "w-[80%]", "w-[88%]", "w-[60%]"]} />
          </div>
          <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
            <div className="skeleton-strong h-5 w-36" />
            <div className="skeleton-strong h-20 w-full rounded-[14px]" />
          </div>
        </aside>
      </div>
    </>
  );
}

/** Project owner settings `/proyek/[slug]/pengaturan` */
function ProjectSettingsSkeleton() {
  return (
    <>
      <BreadcrumbBar parts={3} />
      <div className="mb-8 flex flex-col gap-3">
        <div className="skeleton h-10 w-72 max-w-full rounded-2xl" />
        <div className="skeleton h-4 w-[min(560px,92%)] rounded-full" />
        <div className="skeleton h-4 w-[min(320px,60%)] rounded-full" />
        <div className="skeleton h-11 w-56 rounded-full" />
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="flex items-center gap-3">
            <div className="skeleton-strong h-6 w-28" />
            <div className="skeleton-strong h-6 w-20 rounded-full" />
          </div>
          <TextLines widths={["w-[70%]"]} />
          <div className="flex flex-wrap gap-3">
            <div className="skeleton-strong h-11 w-44 rounded-full" />
            <div className="skeleton-strong h-11 w-40 rounded-full" />
            <div className="skeleton-strong h-11 w-28 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-6 w-72 max-w-full" />
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-2 rounded-[18px] border border-line bg-white p-4">
              <div className="skeleton h-4 w-52" />
              <div className="skeleton h-3.5 w-[82%]" />
            </div>
          ))}
          <div className="skeleton-strong h-12 w-[360px] max-w-full rounded-[14px]" />
          <div className="skeleton-strong h-11 w-48 rounded-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-6 w-40" />
          <TextLines widths={["w-[85%]"]} />
          <div className="skeleton-strong h-16 w-full rounded-[18px]" />
        </div>
      </div>
    </>
  );
}

/** Project moderation decision & appeal `/proyek/[slug]/keputusan` */
function DecisionSkeleton() {
  return (
    <>
      <BreadcrumbBar parts={3} />
      <div className="skeleton mb-3 h-10 w-80 max-w-full rounded-2xl" />
      <div className="skeleton mb-6 h-4 w-[min(420px,90%)] rounded-full" />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="flex items-center gap-3">
            <div className="skeleton-strong h-6 w-56" />
            <div className="skeleton-strong h-6 w-24 rounded-full" />
          </div>
          <TextLines widths={["w-[60%]"]} />
        </div>
        <div className="flex h-20 items-center justify-center rounded-[28px] border border-dashed border-line-strong bg-surface">
          <div className="skeleton-strong h-4 w-64 max-w-[80%]" />
        </div>
      </div>
    </>
  );
}

/** Settings `/akun/setelan` */
function AccountPrivacySkeleton() {
  return (
    <>
      <div className="skeleton mb-3 h-10 w-48 rounded-2xl" />
      <div className="skeleton mb-2 h-4 w-[min(540px,90%)] rounded-full" />
      <div className="skeleton mb-6 h-4 w-[min(260px,60%)] rounded-full" />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-6 w-20" />
          <div className="flex items-center gap-4">
            <div className="skeleton-strong h-[88px] w-[88px] flex-none rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="skeleton-strong h-11 w-40 rounded-full" />
              <div className="skeleton-strong h-3.5 w-[85%]" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="skeleton-strong h-4 w-32" />
            <div className="flex gap-3 max-sm:flex-col">
              <div className="skeleton-strong h-12 flex-1 rounded-[14px] max-sm:flex-none" />
              <div className="skeleton-strong h-12 w-36 rounded-full max-sm:w-full" />
            </div>
          </div>
          <FieldShape label="w-16" strong />
          <div className="skeleton-strong -mt-3 h-3.5 w-72 max-w-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-6 w-40" />
          <TextLines widths={["w-full", "w-[74%]"]} />
          <div className="skeleton-strong h-11 w-48 rounded-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-6 w-48" />
          <TextLines widths={["w-[90%]", "w-[64%]"]} />
          <div className="skeleton-strong h-12 w-64 max-w-full rounded-[14px]" />
          <div className="skeleton-strong h-11 w-36 rounded-full" />
        </div>
      </div>
    </>
  );
}

/** Policy acceptance gate `/kebijakan/setujui` */
function PolicyGateSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-4 rounded-[28px] bg-surface p-6">
      <div className="skeleton-strong h-8 w-72 max-w-full rounded-xl" />
      <div className="skeleton-strong h-4 w-full" />
      <div className="skeleton-strong h-4 w-[82%]" />
      <div className="flex flex-col gap-2">
        <div className="skeleton-strong h-4 w-48" />
        <div className="skeleton-strong h-4 w-52" />
      </div>
      <div className="flex items-center gap-3">
        <div className="skeleton-strong h-5 w-5 rounded-md" />
        <div className="skeleton-strong h-4 w-72 max-w-full" />
      </div>
      <div className="flex gap-3">
        <div className="skeleton-strong h-11 w-40 rounded-full" />
        <div className="skeleton-strong h-11 w-28 rounded-full" />
      </div>
    </div>
  );
}

/** My submitted reports `/laporan-saya` */
function MyReportsSkeleton() {
  return (
    <>
      <div className="skeleton mb-2 h-10 w-60 rounded-2xl" />
      <div className="skeleton mb-6 h-5 w-[min(520px,90%)] rounded-full" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2.5 rounded-[28px] bg-surface p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="skeleton-strong h-6 w-64 max-w-[70%]" />
              <div className="skeleton-strong h-6 w-24 rounded-full" />
            </div>
            <div className="skeleton-strong h-4 w-[88%]" />
            <div className="flex flex-wrap gap-4">
              <div className="skeleton-strong h-3.5 w-28" />
              <div className="skeleton-strong h-3.5 w-36" />
              <div className="skeleton-strong h-3.5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** First-run welcome `/mulai` */
function StartSkeleton() {
  return (
    <>
      <div className="skeleton mb-2 h-10 w-80 max-w-full rounded-2xl" />
      <div className="skeleton mb-8 h-5 w-[min(500px,90%)] rounded-full" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3.5 rounded-[28px] border border-line-soft bg-surface p-7">
            <div className="h-12 w-12 rounded-full bg-lime/70" />
            <div className="skeleton-strong h-7 w-48" />
            <div className="skeleton-strong h-4 w-full" />
            <div className="skeleton-strong h-4 w-[82%]" />
            <div className="skeleton-strong mt-2 h-5 w-28 rounded-full" />
          </div>
        ))}
      </div>
      <div className="skeleton mt-8 h-4 w-36 rounded-full" />
    </>
  );
}

/** Login & Signup `/login`, `/signup` */
function AuthSkeleton({ mode }: { mode: "login" | "signup" }) {
  return (
    <>
      <div className="skeleton mb-2 h-9 w-52 rounded-2xl" />
      <div className="skeleton mb-6 h-5 w-80 max-w-full rounded-full" />
      <div className="flex flex-col gap-4">
        {mode === "signup" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-12 w-full rounded-[14px]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-12 w-full rounded-[14px]" />
              <div className="skeleton h-3.5 w-56" />
            </div>
          </>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-12 w-full rounded-[14px]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-12 w-full rounded-[14px]" />
        </div>
        {mode === "signup" ? (
          <div className="flex items-center gap-3 py-1">
            <div className="skeleton h-5 w-5 flex-none rounded-md" />
            <div className="skeleton h-4 w-full" />
          </div>
        ) : null}
        <div className="skeleton mt-2 h-12 w-full rounded-full" />
        <div className="skeleton mx-auto h-4 w-52 rounded-full" />
        {mode === "login" ? (
          <div className="flex flex-col gap-2 rounded-[18px] bg-warn-bg/65 p-4">
            <div className="skeleton-strong h-4 w-64 max-w-full" />
            <div className="skeleton-strong h-3.5 w-52" />
            <div className="skeleton-strong h-3.5 w-56" />
            <div className="skeleton-strong h-3.5 w-48" />
          </div>
        ) : null}
      </div>
    </>
  );
}

/** The links to the other legal documents, at the foot of every legal page. */
function OtherDocsShape() {
  return (
    <div className="mt-10 border-t border-line-soft pt-6">
      <div className="skeleton mb-3 h-5 w-32" />
      <div className="flex flex-wrap gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-4 w-32 rounded-full" />
        ))}
      </div>
    </div>
  );
}

/** Legal pages `/terms`, `/privacy`, `/pedoman`, `/atribusi` */
function LegalSkeleton() {
  return (
    <>
      <div className="skeleton mb-4 h-10 w-80 max-w-full rounded-2xl" />
      <div className="skeleton mb-2 h-5 w-full rounded-full" />
      <div className="skeleton mb-8 h-5 w-[70%] rounded-full" />
      <div className="flex flex-col gap-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <div className="skeleton h-6 w-56" />
            <TextLines strong={false} widths={["w-full", "w-[96%]", "w-[78%]"]} />
          </div>
        ))}
      </div>
      <OtherDocsShape />
    </>
  );
}

/** Contact page `/kontak` */
function ContactSkeleton() {
  return (
    <>
      <div className="skeleton mb-4 h-10 w-40 rounded-2xl" />
      <div className="skeleton mb-2 h-5 w-full rounded-full" />
      <div className="skeleton mb-8 h-5 w-[30%] rounded-full" />
      <div className="flex flex-col gap-6">
        <div className="rounded-[28px] bg-surface p-6">
          <div className="skeleton-strong h-5 w-64 max-w-full" />
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="skeleton h-6 w-[60%]" />
          <TextLines strong={false} widths={["w-[56%]", "w-[68%]", "w-[52%]"]} />
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="skeleton h-6 w-48" />
          <TextLines strong={false} widths={["w-full", "w-[24%]"]} />
        </div>
      </div>
      <OtherDocsShape />
    </>
  );
}

/** Suspended notice `/suspended` */
function SuspendedSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-[28px] bg-warn-bg/70 p-10 text-center">
      <div className="skeleton-strong h-10 w-10 rounded-full" />
      <div className="skeleton-strong h-8 w-56 rounded-xl" />
      <div className="skeleton-strong h-4 w-80 max-w-full" />
      <div className="skeleton-strong h-4 w-64 max-w-full" />
      <div className="skeleton-strong mt-2 h-11 w-32 rounded-full" />
    </div>
  );
}

/** Internal styleguide `/styleguide` */
function StyleguideSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <div className="skeleton h-4 w-32 rounded-full" />
        <div className="skeleton h-12 w-80 max-w-full rounded-2xl" />
        <div className="skeleton h-5 w-[min(560px,90%)] rounded-full" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-[20px] border border-line bg-white">
            <div className="skeleton h-16 rounded-none" />
            <div className="flex flex-col gap-1.5 p-3">
              <div className="skeleton h-3.5 w-20" />
              <div className="skeleton h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

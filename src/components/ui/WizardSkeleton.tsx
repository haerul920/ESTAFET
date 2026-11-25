"use client";

import { usePathname } from "next/navigation";
import { BreadcrumbBar, FieldShape, StepperBar, TextLines, WizardButtons } from "./skeleton-shapes";

const STEPS = ["info", "berkas", "tinjau", "tim", "terbit"] as const;
type Step = (typeof STEPS)[number];

function Heading() {
  return (
    <div className="mb-6">
      <div className="skeleton mb-3 h-9 w-80 max-w-full rounded-2xl" />
      <div className="skeleton mb-2 h-4 w-[min(600px,92%)] rounded-full" />
      <div className="skeleton h-4 w-[min(430px,70%)] rounded-full" />
    </div>
  );
}

/** Step 1: one column of fields. Also used for a new project at `/bagikan`. */
export function InfoStepShapes() {
  return (
    <div className="flex flex-col gap-5">
      <FieldShape />
      <FieldShape label="w-32" />
      <FieldShape label="w-40" />
      <FieldShape label="w-36" />
      <FieldShape label="w-44" box="h-20" />
      <WizardButtons back={false} />
    </div>
  );
}

/** Step 2: the privacy line, then the two ways to fill the draft. */
function FilesShapes() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-12 items-center rounded-[14px] bg-blue-tint px-4">
        <div className="skeleton-strong h-4 w-[70%]" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-[28px] border border-line-soft bg-white p-6">
          <div className="skeleton h-5 w-52" />
          <TextLines strong={false} widths={["w-full", "w-[70%]"]} />
          {i === 0 ? <div className="skeleton h-24 w-full rounded-[14px]" /> : null}
          <div className="skeleton h-11 w-56 max-w-full rounded-full" />
        </div>
      ))}
      <WizardButtons />
    </div>
  );
}

/** Step 3: the summary card, two tabs, the progress line and the items. */
function ReviewShapes() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[28px] bg-blue-tint p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="skeleton-strong h-5 w-44" />
          <div className="skeleton-strong h-9 w-36 rounded-full" />
        </div>
        <div className="skeleton-strong h-4 w-[85%]" />
      </div>
      <div className="skeleton h-4 w-[min(640px,95%)] rounded-full" />
      <div className="flex gap-6 border-b border-line-soft pb-3">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-5 w-20" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="skeleton h-3.5 w-28" />
        <div className="skeleton h-2 w-full rounded-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-3xl border border-line-soft bg-white p-4">
          <div className="skeleton h-5 w-[55%]" />
          <div className="skeleton h-4 w-[85%]" />
          <div className="flex gap-2">
            <div className="skeleton h-11 w-36 rounded-full" />
            <div className="skeleton h-11 w-24 rounded-full" />
            <div className="skeleton h-11 w-24 rounded-full" />
          </div>
        </div>
      ))}
      <WizardButtons />
    </div>
  );
}

/** Step 4: the team, then the access rules, then the buttons. */
function TeamShapes() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
        <div className="skeleton-strong h-6 w-40" />
        <TextLines widths={["w-full", "w-[78%]"]} />
        <div className="flex items-center justify-between gap-3 rounded-[18px] border border-line-soft bg-white p-4">
          <div className="flex flex-col gap-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3.5 w-32" />
          </div>
          <div className="skeleton h-11 w-36 rounded-full" />
        </div>
        <div className="mt-3 border-t border-line pt-5">
          <div className="skeleton-strong mb-1.5 h-4 w-56" />
          <div className="flex gap-3 max-sm:flex-col">
            <div className="skeleton-strong h-12 flex-1 rounded-[14px] max-sm:flex-none" />
            <div className="skeleton-strong h-12 w-32 rounded-full max-sm:w-full" />
          </div>
          <div className="skeleton-strong mt-2 h-3.5 w-[90%]" />
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
        <div className="skeleton-strong h-6 w-72 max-w-full" />
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-[18px] border border-line bg-white p-4">
            <div className="skeleton h-4 w-52" />
            <div className="skeleton h-3.5 w-[80%]" />
          </div>
        ))}
        <div className="skeleton-strong h-12 w-[360px] max-w-full rounded-[14px]" />
      </div>
      <WizardButtons />
    </div>
  );
}

/** Step 5: the preview of the public page, then the checklist. */
function PublishShapes() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 rounded-[28px] border border-line p-6">
        <div className="skeleton h-6 w-24 rounded-full" />
        <div className="skeleton h-10 w-[60%] rounded-2xl" />
        <div className="skeleton h-4 w-[80%] rounded-full" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
            <div className="skeleton-strong h-6 w-56" />
            <TextLines widths={["w-full", "w-[72%]"]} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-[28px] bg-surface p-6">
        <div className="skeleton-strong h-6 w-44" />
        <TextLines widths={["w-[70%]", "w-[62%]", "w-[66%]"]} />
      </div>
      <WizardButtons />
    </div>
  );
}

const BODY: Record<Step, () => React.ReactNode> = {
  info: InfoStepShapes,
  berkas: FilesShapes,
  tinjau: ReviewShapes,
  tim: TeamShapes,
  terbit: PublishShapes,
};

/** The five steps share one route file, so the shape follows the step named in the address. */
export function WizardStepSkeleton() {
  const last = usePathname().split("/").pop() ?? "";
  const step: Step = (STEPS as readonly string[]).includes(last) ? (last as Step) : "info";
  const Body = BODY[step];
  return (
    <>
      <BreadcrumbBar />
      <StepperBar current={STEPS.indexOf(step) + 1} />
      <Heading />
      <Body />
    </>
  );
}

/** A new project: the first step. */
export function WizardBasicsSkeleton() {
  return (
    <>
      <BreadcrumbBar />
      <StepperBar current={1} />
      <Heading />
      <InfoStepShapes />
    </>
  );
}

import { useTranslations } from "next-intl";

export type AdminSkeletonVariant =
  | "overview"
  | "projects"
  | "reports"
  | "appeals"
  | "users"
  | "audit"
  | "detail"
  | "userDetail"
  | "breakGlass"
  | "announcements"
  | "policies"
  | "policyEditor"
  | "settings";

/**
 * Route-accurate loading states for every admin page inside `AdminShell`.
 * Each variant replicates the actual headers, stat cards, filter rows, data tables, and panels of that route.
 */
export function AdminSkeleton({ variant = "overview" }: { variant?: AdminSkeletonVariant }) {
  const t = useTranslations("admin.common");
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")}>
      <div aria-hidden="true">
        {variant === "overview" ? <OverviewShapes /> : null}
        {variant === "projects" ? <ListShapes filters={2} cols={6} /> : null}
        {variant === "reports" ? <ListShapes filters={1} cols={5} /> : null}
        {variant === "appeals" ? <ListShapes filters={1} cols={4} /> : null}
        {variant === "users" ? <ListShapes filters={1} cols={7} tall /> : null}
        {variant === "audit" ? <AuditShapes /> : null}
        {variant === "detail" ? <ProjectDetailShapes /> : null}
        {variant === "userDetail" ? <UserDetailShapes /> : null}
        {variant === "breakGlass" ? <BreakGlassShapes /> : null}
        {variant === "announcements" ? <AnnouncementsShapes /> : null}
        {variant === "policies" ? <PoliciesShapes /> : null}
        {variant === "policyEditor" ? <PolicyEditorShapes /> : null}
        {variant === "settings" ? <SettingsShapes /> : null}
      </div>
    </div>
  );
}

function HeaderBar({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="skeleton mb-3 h-9 w-48 rounded-xl" />
        <div className="skeleton h-4 w-[min(520px,70vw)] rounded-full" />
      </div>
      {withAction ? <div className="skeleton h-11 w-56 rounded-full" /> : null}
    </div>
  );
}

/** The search box with its dropdowns beside it, each under its label. */
function FilterRow({ filters }: { filters: number }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="skeleton h-12 min-w-[240px] flex-1 rounded-[14px]" />
      {Array.from({ length: filters }, (_, i) => (
        <div key={i} className="flex flex-[0_1_220px] flex-col gap-1.5 max-md:flex-[1_1_100%]">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-12 w-full rounded-[14px]" />
        </div>
      ))}
    </div>
  );
}

function DataTableShapes({ cols, rows = 10, tall = false }: { cols: number; rows?: number; tall?: boolean }) {
  const grid = { gridTemplateColumns: `1.7fr repeat(${cols - 1}, minmax(0, 1fr))` };
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      <div className="grid gap-3 bg-surface px-4 py-4" style={grid}>
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className="skeleton-strong h-3.5 w-20 max-w-full rounded-full" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className={`grid items-center gap-3 border-t border-line px-4 ${tall ? "py-6" : "py-3.5"}`}
          style={grid}
        >
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className={`skeleton h-4 ${c === 0 ? "w-[85%]" : "w-[60%]"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** `/admin/projects`, `/admin/reports`, `/admin/appeals`, `/admin/users` */
function ListShapes({ filters, cols, tall }: { filters: number; cols: number; tall?: boolean }) {
  return (
    <>
      <HeaderBar />
      <FilterRow filters={filters} />
      <DataTableShapes cols={cols} tall={tall} rows={tall ? 6 : 10} />
    </>
  );
}

function PanelShape({ children, title = "w-44" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4">
      <div className={`skeleton-strong h-3.5 rounded-full ${title}`} />
      {children}
    </div>
  );
}

function CountRows({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="skeleton-strong h-5 w-24 rounded-full" />
          <div className="skeleton-strong h-4 w-8" />
        </div>
      ))}
    </>
  );
}

function PairRows({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="grid grid-cols-[180px_1fr] gap-3 max-sm:grid-cols-1">
          <div className="skeleton-strong h-4 w-28" />
          <div className="skeleton-strong h-4 w-[min(260px,100%)]" />
        </div>
      ))}
    </>
  );
}

/** `/admin` overview: two queues, the number panels and the latest audit rows. */
function OverviewShapes() {
  return (
    <>
      <HeaderBar />
      <div className="skeleton mb-2 h-3.5 w-24 rounded-full" />
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <div className="flex h-[104px] flex-col gap-3 rounded-3xl bg-warn-bg p-4">
          <div className="skeleton-strong h-3.5 w-32" />
          <div className="skeleton-strong h-9 w-16 rounded-xl" />
        </div>
        <div className="flex h-[104px] flex-col gap-3 rounded-3xl bg-surface p-4">
          <div className="skeleton-strong h-3.5 w-32" />
          <div className="skeleton-strong h-9 w-12 rounded-xl" />
        </div>
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[3, 5, 4, 2, 6, 3, 5].map((rows, i) => (
          <PanelShape key={i}>
            <CountRows rows={rows} />
          </PanelShape>
        ))}
      </div>
      <PanelShape>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between border-t border-line pt-2.5">
            <div className="skeleton-strong h-4 w-72 max-w-[70%]" />
            <div className="skeleton-strong h-3.5 w-24" />
          </div>
        ))}
      </PanelShape>
    </>
  );
}

/** `/admin/audit` */
function AuditShapes() {
  return (
    <>
      <HeaderBar withAction />
      <div className="mb-4 flex h-11 items-center rounded-2xl bg-blue-tint px-4">
        <div className="skeleton-strong h-4 w-96 max-w-full" />
      </div>
      <div className="skeleton mb-3 h-11 w-full rounded-full" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="skeleton h-3.5 w-24 rounded-full" />
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="skeleton h-11 w-52 rounded-[14px]" />
        <div className="skeleton h-11 w-52 rounded-[14px]" />
        <div className="skeleton h-11 w-24 rounded-full" />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="skeleton h-10 w-44 rounded-xl" />
        <div className="skeleton h-10 w-44 rounded-xl" />
      </div>
      <DataTableShapes cols={5} rows={7} />
    </>
  );
}

function DetailHeader({ pills }: { pills: number }) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="skeleton mb-3 h-9 w-72 max-w-full rounded-xl" />
          <div className="skeleton h-4 w-56 rounded-full" />
        </div>
        <div className="flex gap-2 pt-10">
          {Array.from({ length: pills }, (_, i) => (
            <div key={i} className="skeleton h-7 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <div className="skeleton mb-4 h-4 w-44 rounded-full" />
    </>
  );
}

/** `/admin/projects/[id]` */
function ProjectDetailShapes() {
  return (
    <>
      <DetailHeader pills={3} />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PanelShape title="w-28">
            <PairRows rows={5} />
          </PanelShape>
          <PanelShape title="w-52">
            <div className="skeleton-strong h-4 w-full" />
            <div className="skeleton-strong h-4 w-[86%]" />
            {Array.from({ length: 9 }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="skeleton-strong h-5 w-20 rounded-full" />
                <div className="skeleton-strong h-4 w-72 max-w-full" />
              </div>
            ))}
          </PanelShape>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <PanelShape title="w-24">
            <div className="skeleton-strong h-11 w-24 rounded-full" />
          </PanelShape>
          <PanelShape title="w-48">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col gap-1.5 pl-4">
                <div className="skeleton-strong h-4 w-48 max-w-full" />
                <div className="skeleton-strong h-3 w-24" />
              </div>
            ))}
          </PanelShape>
        </div>
      </div>
    </>
  );
}

/** `/admin/users/[id]` */
function UserDetailShapes() {
  return (
    <>
      <DetailHeader pills={1} />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PanelShape title="w-20">
            <PairRows rows={8} />
          </PanelShape>
          <PanelShape title="w-20">
            <CountRows rows={4} />
          </PanelShape>
          <PanelShape title="w-52">
            <div className="skeleton-strong h-4 w-24" />
          </PanelShape>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <PanelShape title="w-32">
            <div className="skeleton-strong h-11 w-48 rounded-full" />
            <div className="skeleton-strong h-9 w-28 rounded-full" />
          </PanelShape>
          <PanelShape title="w-52">
            <div className="skeleton-strong h-4 w-32" />
          </PanelShape>
        </div>
      </div>
    </>
  );
}

/** `/admin/projects/[id]/break-glass/[access]` */
function BreakGlassShapes() {
  return (
    <div className="pt-4">
      <div className="mb-4 h-12 rounded-2xl bg-warn-bg/75 p-3">
        <div className="skeleton-strong h-5 w-80 max-w-full" />
      </div>
      <div className="skeleton mb-4 h-8 w-72 max-w-full rounded-xl" />
      <PanelShape title="w-40">
        <PairRows rows={4} />
        <div className="skeleton-strong mt-2 h-11 w-44 rounded-full" />
      </PanelShape>
    </div>
  );
}

/** `/admin/announcements` */
function AnnouncementsShapes() {
  return (
    <>
      <HeaderBar />
      <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-surface p-4">
        <div className="skeleton-strong h-3.5 w-36 rounded-full" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="skeleton-strong h-24 rounded-2xl" />
          <div className="skeleton-strong h-24 rounded-2xl" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="skeleton-strong h-12 rounded-[14px]" />
          <div className="skeleton-strong h-12 rounded-[14px]" />
          <div className="skeleton-strong h-12 rounded-[14px]" />
        </div>
        <div className="skeleton-strong h-5 w-64 max-w-full" />
        <div className="skeleton-strong h-11 w-52 rounded-full" />
      </div>
      <PanelShape title="w-24">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex gap-2">
              <div className="skeleton-strong h-5 w-20 rounded-full" />
              <div className="skeleton-strong h-5 w-14 rounded-full" />
            </div>
            <div className="skeleton-strong h-4 w-[40%]" />
            <div className="skeleton-strong h-3.5 w-[36%]" />
          </div>
        ))}
      </PanelShape>
    </>
  );
}

/** `/admin/policies`: one panel per document; the two versioned ones list their versions. */
function PoliciesShapes() {
  return (
    <>
      <HeaderBar />
      <div className="grid gap-4 md:grid-cols-2">
        {[true, true, false, false].map((versioned, i) => (
          <PanelShape key={i} title="w-48">
            <div className="skeleton-strong h-4 w-64 max-w-full" />
            {versioned ? (
              <div className="flex items-center justify-between">
                <div className="skeleton-strong h-4 w-36" />
                <div className="skeleton-strong h-5 w-20 rounded-full" />
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <div className="skeleton-strong h-11 w-44 rounded-full" />
              <div className="skeleton-strong h-4 w-32" />
            </div>
          </PanelShape>
        ))}
      </div>
    </>
  );
}

/** `/admin/policies/[doc]`: the toolbar, then the page being written. */
function PolicyEditorShapes() {
  return (
    <>
      <HeaderBar />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="skeleton h-4 w-40 rounded-full" />
        <div className="flex flex-wrap items-center gap-3">
          <div className="skeleton h-11 w-56 rounded-full" />
          <div className="skeleton h-11 w-44 rounded-full" />
          <div className="h-11 w-28 rounded-full bg-lime/60" />
        </div>
      </div>
      <div className="skeleton mb-4 h-4 w-44 rounded-full" />
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 rounded-[28px] bg-white px-6 py-8">
        <div className="skeleton h-3.5 w-[85%]" />
        <div className="skeleton h-14 w-full rounded-[10px]" />
        <div className="skeleton mb-4 h-24 w-full rounded-[10px]" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="skeleton h-9 w-full rounded-[10px]" />
            <div className="skeleton h-24 w-full rounded-[10px]" />
          </div>
        ))}
      </div>
    </>
  );
}

/** `/admin/settings`: groups of rows, each with its value and its save button. */
function SettingsShapes() {
  return (
    <>
      <HeaderBar />
      {[3, 4, 1].map((rows, group) => (
        <div key={group} className="mb-4 flex flex-col gap-4 rounded-3xl bg-surface p-4">
          <div className="skeleton-strong h-3.5 w-24 rounded-full" />
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex flex-wrap items-start justify-between gap-3 border-t border-line pt-4">
              <div className="flex flex-col gap-2">
                <div className="skeleton-strong h-4 w-52" />
                <div className="skeleton-strong h-3.5 w-80 max-w-full" />
                <div className="skeleton-strong h-5 w-28 rounded-full" />
              </div>
              <div className="flex items-start gap-2">
                <div className="skeleton-strong h-11 w-60 max-w-full rounded-[14px]" />
                <div className="skeleton-strong h-9 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

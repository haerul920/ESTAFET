/** Pure helpers for the audit viewer: key-by-key diff and CSV. */
export interface AuditEvent {
  id: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface DiffLine {
  key: string;
  before: string;
  after: string;
  kind: "added" | "removed" | "changed" | "same";
}

const show = (v: unknown) => (v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v));

export function diffObjects(before: Record<string, unknown> | null, after: Record<string, unknown> | null): DiffLine[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  return keys.map((key) => {
    const b = before?.[key];
    const a = after?.[key];
    const bs = show(b);
    const as = show(a);
    const kind: DiffLine["kind"] = b === undefined ? "added" : a === undefined ? "removed" : bs === as ? "same" : "changed";
    return { key, before: bs, after: as, kind };
  });
}

const esc = (v: string | null) => {
  if (v === null) return "";
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function auditCsv(rows: AuditEvent[]): string {
  const head = "when_utc,actor,action,target_type,target_id,reason,before,after";
  const lines = rows.map((r) =>
    [r.created_at, r.actor_name, r.action, r.target_type, r.target_id, r.reason, r.before ? JSON.stringify(r.before) : null, r.after ? JSON.stringify(r.after) : null].map((v) => esc(v as string | null)).join(","),
  );
  return [head, ...lines].join("\n") + "\n";
}

import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · ESTAFET" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <AdminShell adminName={user.profile?.full_name || user.email}>{children}</AdminShell>;
}

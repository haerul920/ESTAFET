import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Removes demo files from Storage (SQL cannot delete storage objects). Paths come from admin_demo_storage_paths(). */
export async function removeDemoObjects(paths: string[]): Promise<void> {
  const admin = createAdminClient();
  const unique = [...new Set(paths.filter(Boolean))];
  const files = unique.filter((p) => !p.endsWith(".json"));
  const texts = unique.filter((p) => p.endsWith(".json") && !p.endsWith(".tree.json"));
  const trees = unique.filter((p) => p.endsWith(".tree.json"));
  for (let i = 0; i < files.length + trees.length; i += 100)
    await admin.storage.from("project-files").remove([...files, ...trees].slice(i, i + 100));
  for (let i = 0; i < texts.length; i += 100)
    await admin.storage.from("extracted-text").remove(texts.slice(i, i + 100));
}

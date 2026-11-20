import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSettings, type EffectiveSettings } from "@/lib/settings-core";

export * from "@/lib/settings-core";

/** Effective settings: `app_settings` rows override env defaults. Cached per request. */
export const getSettings = cache(async (): Promise<EffectiveSettings> => {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("app_settings").select("key, value");
    return resolveSettings(data ?? [], process.env);
  } catch {
    return resolveSettings([], process.env);
  }
});

export const uuidSchema = z.string().uuid();

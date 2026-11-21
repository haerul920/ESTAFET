import { describe, expect, it } from "vitest";
import { pickPublicKey, pickSecretKey } from "@/lib/supabase/keys";

describe("Supabase key names", () => {
  it("accepts the older and the newer public key name, and prefers the older one when both are set", () => {
    expect(pickPublicKey({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" })).toBe("anon");
    expect(pickPublicKey({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" })).toBe("sb_publishable_x");
    expect(pickPublicKey({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub" })).toBe("anon");
  });
  it("treats an empty value as missing, so a blank line in .env does not hide the other name", () => {
    expect(pickPublicKey({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub" })).toBe("pub");
    expect(pickSecretKey({ SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SECRET_KEY: "sb_secret_y" })).toBe("sb_secret_y");
    expect(pickPublicKey({})).toBeUndefined();
    expect(pickSecretKey({})).toBeUndefined();
  });
  it("accepts the older and the newer private key name", () => {
    expect(pickSecretKey({ SUPABASE_SERVICE_ROLE_KEY: "role" })).toBe("role");
    expect(pickSecretKey({ SUPABASE_SECRET_KEY: "sb_secret_y" })).toBe("sb_secret_y");
  });
});

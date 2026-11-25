import { describe, expect, it } from "vitest";
import { avatarSrc, isJpeg, ownAvatarPath } from "@/lib/account/avatar";

const ME = "0b7c2b0e-1111-4222-8333-444455556666";
const OTHER = "9a9a9a9a-1111-4222-8333-444455556666";

describe("profile photos", () => {
  it("accepts only real JPEG bytes", () => {
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe(false);
    expect(isJpeg(new TextEncoder().encode("<svg onload=alert(1)>"))).toBe(false);
    expect(isJpeg(new Uint8Array([]))).toBe(false);
  });

  it("only uses a path inside the person's own folder", () => {
    expect(ownAvatarPath(ME, `${ME}/abc-123.jpg`)).toBe(`${ME}/abc-123.jpg`);
    for (const bad of [
      `${OTHER}/abc.jpg`,
      `${ME}/../${OTHER}/abc.jpg`,
      `${ME}/nested/abc.jpg`,
      `${ME}/abc.svg`,
      "https://example.com/a.jpg",
      "",
      null,
    ])
      expect(ownAvatarPath(ME, bad)).toBeNull();
  });

  it("gives an address that changes with the photo, or none", () => {
    expect(avatarSrc(ME, `${ME}/abc-123.jpg`)).toBe("/api/account/avatar?v=abc-123");
    expect(avatarSrc(ME, `${OTHER}/abc.jpg`)).toBeNull();
  });
});

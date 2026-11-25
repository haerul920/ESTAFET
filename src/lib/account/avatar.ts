/** Rules for profile photos. Pure functions, so the server, the route and the tests share them. */
export const AVATAR_BUCKET = "avatars";
/** The browser sends a 512 px JPEG, usually well under 100 KB. This leaves plenty of room. */
export const AVATAR_MAX_BYTES = 800_000;
/** The largest picture the browser will open before shrinking it. */
export const AVATAR_MAX_SOURCE_BYTES = 10_000_000;

/** Checks the first bytes, not the file name or the type the browser claims. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * The stored path, only if it is in this person's own folder. `profiles.avatar_url` can be written by its owner, so it
 * is never trusted to name a file: without this check a person could point it at someone else's photo.
 */
export function ownAvatarPath(userId: string, stored: string | null | undefined): string | null {
  const match = /^([^/]+)\/([A-Za-z0-9-]+\.jpg)$/.exec(stored ?? "");
  return match && match[1] === userId ? match[0] : null;
}

/** The address of the signed-in person's own photo. The file name in the query changes with every new photo. */
export function avatarSrc(userId: string, stored: string | null | undefined): string | null {
  const path = ownAvatarPath(userId, stored);
  return path ? `/api/account/avatar?v=${path.slice(userId.length + 1, -4)}` : null;
}

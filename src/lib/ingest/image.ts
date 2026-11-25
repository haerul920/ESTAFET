import sharp from "sharp";
import { LIMITS } from "./limits";
import { UploadRejected } from "./magic";

const open = (data: Uint8Array) => sharp(data, { limitInputPixels: LIMITS.imageMaxPixels, failOn: "error" });

export interface CheckedImage {
  /** The picture written again: turned the right way up, without the hidden data cameras add (such as location). */
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png";
  width: number;
  height: number;
}

/** Decodes the whole picture, so a damaged or disguised file is refused, then writes it again without metadata. */
export async function checkImage(data: Uint8Array): Promise<CheckedImage> {
  try {
    const meta = await open(data).metadata();
    if (meta.format !== "jpeg" && meta.format !== "png") throw new UploadRejected("image_broken");
    const turned = open(data).rotate();
    const encoded = meta.format === "jpeg" ? turned.jpeg({ quality: 92 }) : turned.png();
    const { data: bytes, info } = await encoded.toBuffer({ resolveWithObject: true });
    return {
      bytes: new Uint8Array(bytes),
      contentType: meta.format === "jpeg" ? "image/jpeg" : "image/png",
      width: info.width,
      height: info.height,
    };
  } catch (e) {
    if (e instanceof UploadRejected) throw e;
    if (e instanceof Error && /pixel limit/i.test(e.message)) throw new UploadRejected("image_too_large");
    throw new UploadRejected("image_broken");
  }
}

/** A smaller JPEG for the AI (base64), so a picture of any accepted size fits what the providers take. */
export async function imageForAi(data: Uint8Array): Promise<string> {
  const jpeg = await open(data)
    .rotate()
    .resize({ width: LIMITS.aiImageSide, height: LIMITS.aiImageSide, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82 })
    .toBuffer();
  return jpeg.toString("base64");
}

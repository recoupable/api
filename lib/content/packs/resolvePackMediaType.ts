import { validatePackMediaBytes } from "./validatePackMediaBytes";
/** File attachment metadata is optional; determine supported media from actual bounded bytes. */
export function resolvePackMediaType(bytes: Buffer, declared?: string) {
  if (declared && declared !== "application/octet-stream")
    return validatePackMediaBytes(bytes, declared).contentType;
  for (const candidate of [
    "image/png",
    "image/jpeg",
    "image/webp",
    "audio/mpeg",
    "audio/wav",
    "audio/flac",
    "audio/mp4",
  ]) {
    try {
      return validatePackMediaBytes(bytes, candidate).contentType;
    } catch {
      /* Try the next supported binary signature. */
    }
  }
  throw new Error("Selected file is not supported audio or imagery");
}

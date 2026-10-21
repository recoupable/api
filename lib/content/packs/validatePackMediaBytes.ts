/** Bound selected files and sniff magic bytes before storing or sending to providers. */
export function validatePackMediaBytes(bytes: Buffer, declaredType: string) {
  if (!bytes.length || bytes.length > 50 * 1024 * 1024)
    throw new Error("Media must be between 1 byte and 50 MiB");
  const mime = declaredType.split(";")[0].toLowerCase();
  const head = bytes.subarray(0, 16);
  const ascii = head.toString("ascii");
  const valid: Record<string, boolean> = {
    "audio/mpeg": ascii.startsWith("ID3") || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0),
    "audio/wav": ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE",
    "audio/x-wav": ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE",
    "audio/flac": ascii.startsWith("fLaC"),
    "audio/mp4": ascii.slice(4, 8) === "ftyp",
    "image/png": head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/jpeg": head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff,
    "image/webp": ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP",
    "video/mp4": ascii.slice(4, 8) === "ftyp",
  };
  if (!valid[mime]) throw new Error("Media content does not match its supported MIME type");
  if (mime.startsWith("image/") && bytes.length > 10 * 1024 * 1024)
    throw new Error("Reference images must be at most 10 MiB");
  return { contentType: mime === "audio/x-wav" ? "audio/wav" : mime, bytes: bytes.length };
}

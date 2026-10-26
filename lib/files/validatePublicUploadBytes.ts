/** Validate supported binary signatures or UTF-8 text without changing uploaded bytes. */
export function validatePublicUploadBytes(bytes: Buffer, contentType: string): boolean {
  if (!bytes.length) return false;
  const ascii = bytes.subarray(0, 16).toString("ascii");
  switch (contentType) {
    case "image/png":
      return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case "image/jpeg":
      return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    case "image/gif":
      return ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
    case "image/webp":
      return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
    case "application/pdf":
      return ascii.startsWith("%PDF-");
    case "audio/mpeg":
      return ascii.startsWith("ID3") || (bytes[0] === 255 && (bytes[1] & 224) === 224);
    case "audio/wav":
      return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE";
    case "audio/x-m4a":
      return ascii.slice(4, 8) === "ftyp";
    case "audio/webm":
      return bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
    case "text/csv":
    case "text/markdown":
    case "text/x-markdown":
    case "text/plain":
    case "application/json":
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        if (text.includes("\0")) return false;
        if (contentType === "application/json") JSON.parse(text);
        return true;
      } catch {
        return false;
      }
    default:
      return false;
  }
}

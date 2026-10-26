/** The hosted function accepts at most 4.5 MB including multipart overhead. */
export const MAX_UPLOAD_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_BODY_BYTES = MAX_UPLOAD_FILE_BYTES + 64 * 1024;
/** Matches the existing public-uploads bucket; never use this for private Files. */
export const PUBLIC_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/csv",
  "text/markdown",
  "text/x-markdown",
  "text/plain",
  "application/json",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
  "audio/webm",
] as const;

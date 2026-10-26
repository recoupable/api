import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_UPLOAD_FILE_BYTES, PUBLIC_UPLOAD_MIME_TYPES } from "./uploadLimits";
import { uploadErrorResponse } from "./uploadErrorResponse";

const uploadFileBodySchema = z.strictObject({ file: z.instanceof(File) });
/** Exactly one nonempty file; identity and object keys are never request fields. */
export function validateUploadFileBody(form: FormData): File | NextResponse {
  const entries = [...form.entries()];
  const parsed = uploadFileBodySchema.safeParse(Object.fromEntries(entries));
  if (entries.length !== 1 || !parsed.success || parsed.data.file.size === 0)
    return uploadErrorResponse(400, "Provide exactly one nonempty file");
  const file = parsed.data.file;
  if (file.size > MAX_UPLOAD_FILE_BYTES) return uploadErrorResponse(413, "Upload exceeds 4 MiB");
  if (!(PUBLIC_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type))
    return uploadErrorResponse(415, "Unsupported file type");
  return file;
}

import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import type { CreateFileResult } from "@/lib/github/createOrUpdateFileContent";

/** Preserve partial receipts and distinguish conflict-only from mixed failures. */
export function buildFileUploadResponse(
  uploaded: CreateFileResult[],
  errors: string[],
  conflicts: string[],
): NextResponse {
  if (uploaded.length === 0)
    return NextResponse.json(
      {
        status: "error",
        error: `All uploads failed: ${errors.join("; ")}`,
        ...(conflicts.length > 0 && { conflicts }),
      },
      {
        status: conflicts.length > 0 && conflicts.length === errors.length ? 409 : 500,
        headers: getCorsHeaders(),
      },
    );
  return NextResponse.json(
    {
      status: "success",
      uploaded,
      ...(errors.length > 0 && { errors }),
      ...(conflicts.length > 0 && { conflicts }),
    },
    { status: 200, headers: getCorsHeaders() },
  );
}

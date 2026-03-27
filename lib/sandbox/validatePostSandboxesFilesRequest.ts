import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { buildGetSandboxesParams } from "./buildGetSandboxesParams";

export interface ValidatedPostSandboxesFilesParams {
  accountIds?: string[];
  path: string;
  message: string;
  files: { name: string; content: Buffer }[];
}

/**
 * Validates POST /api/sandboxes/files request.
 * Handles authentication and multipart form data parsing.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or validated params
 */
export async function validatePostSandboxesFilesRequest(
  request: NextRequest,
): Promise<NextResponse | ValidatedPostSandboxesFilesParams> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { accountId } = authResult;

  const { params, error } = await buildGetSandboxesParams({
    account_id: accountId,
  });

  if (error) {
    return NextResponse.json(
      { status: "error", error },
      { status: 403, headers: getCorsHeaders() },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Request must be multipart/form-data" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const path = (formData.get("path") as string) ?? "";
  const message = (formData.get("message") as string) ?? "Upload files via API";

  const fileEntries = formData.getAll("files");
  if (!fileEntries.length) {
    return NextResponse.json(
      { status: "error", missing_fields: ["files"], error: "At least one file is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const files: { name: string; content: Buffer }[] = [];
  for (const entry of fileEntries) {
    if (!(entry instanceof File)) {
      return NextResponse.json(
        { status: "error", error: "Invalid file entry" },
        { status: 400, headers: getCorsHeaders() },
      );
    }
    const arrayBuffer = await entry.arrayBuffer();
    files.push({
      name: entry.name,
      content: Buffer.from(arrayBuffer),
    });
  }

  return {
    accountIds: params.accountIds,
    path,
    message,
    files,
  };
}

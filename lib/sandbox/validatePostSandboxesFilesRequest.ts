import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { buildGetSandboxesParams } from "./buildGetSandboxesParams";
import { z } from "zod";

const postSandboxesFilesSchema = z.object({
  files: z
    .array(
      z.object({
        url: z.string().url("Each file must have a valid URL"),
        name: z.string().min(1, "Each file must have a name"),
      }),
    )
    .min(1, "At least one file is required"),
  path: z.string().optional().default(""),
  message: z.string().optional().default("Upload files via API"),
});

export type PostSandboxesFilesBody = z.infer<typeof postSandboxesFilesSchema>;

export interface ValidatedPostSandboxesFilesParams {
  accountIds?: string[];
  path: string;
  message: string;
  files: { url: string; name: string }[];
}

/**
 * Validates POST /api/sandboxes/files request.
 * Handles authentication and JSON body parsing.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Request body must be valid JSON" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const result = postSandboxesFilesSchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return {
    accountIds: params.accountIds,
    path: result.data.path,
    message: result.data.message,
    files: result.data.files,
  };
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext, type AuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { z } from "zod";

const sandboxQuerySchema = z.object({
  account_id: z.string().uuid("account_id must be a valid UUID").optional(),
});

export const sandboxBodySchema = z
  .object({
    command: z.string().min(1, "command cannot be empty").optional(),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    prompt: z.string().min(1, "prompt cannot be empty").optional(),
  })
  .refine(data => !(data.command && data.prompt), {
    message: "Cannot specify both command and prompt",
    path: ["prompt"],
  });

export type SandboxBody = z.infer<typeof sandboxBodySchema> & AuthContext;

/**
 * Validates auth and request body for POST /api/sandboxes.
 * Supports optional account_id query parameter for org API keys to target a specific account.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated body with auth context.
 */
export async function validateSandboxBody(
  request: NextRequest,
): Promise<NextResponse | SandboxBody> {
  const { searchParams } = new URL(request.url);
  const queryParams = {
    account_id: searchParams.get("account_id") ?? undefined,
  };

  const queryResult = sandboxQuerySchema.safeParse(queryParams);
  if (!queryResult.success) {
    const firstError = queryResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const { account_id: targetAccountId } = queryResult.data;

  const authResult = await validateAuthContext(request, {
    accountId: targetAccountId,
  });
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body = await safeParseJson(request);
  const result = sandboxBodySchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return {
    ...authResult,
    ...result.data,
  };
}

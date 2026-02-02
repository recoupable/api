import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext, type AuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { z } from "zod";

export const sandboxBodySchema = z.object({
  prompt: z.string({ message: "prompt is required" }).min(1, "prompt cannot be empty"),
});

export type SandboxBody = z.infer<typeof sandboxBodySchema> & AuthContext;

/**
 * Validates auth and request body for POST /api/sandboxes.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated body with auth context.
 */
export async function validateSandboxBody(
  request: NextRequest,
): Promise<NextResponse | SandboxBody> {
  const authResult = await validateAuthContext(request);
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

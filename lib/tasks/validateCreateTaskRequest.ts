import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";
import { createTaskBodySchema, type CreateTaskBody } from "@/lib/tasks/createTaskBodySchema";

/**
 * Validates POST /api/tasks: auth first, then JSON body, Zod schema, then account_id override.
 *
 * @param request - The incoming Next.js request
 * @returns Error response or {@link CreateTaskBody} with account_id set from resolved auth context
 */
export async function validateCreateTaskRequest(
  request: NextRequest,
): Promise<NextResponse | CreateTaskBody> {
  const authBase = await validateAuthContext(request, {});
  if (authBase instanceof NextResponse) {
    return authBase;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const validationResult = createTaskBodySchema.safeParse(body);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
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

  const validatedBody = validationResult.data;

  const overrideResult = await validateAccountIdOverride({
    currentAccountId: authBase.accountId,
    targetAccountId: validatedBody.account_id,
  });
  if (overrideResult instanceof NextResponse) {
    return overrideResult;
  }

  return {
    ...validatedBody,
    account_id: overrideResult.accountId,
  };
}

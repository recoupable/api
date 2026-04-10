import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { createTaskBodySchema, type CreateTaskBody } from "@/lib/tasks/validateCreateTaskBody";

/**
 * Validates POST /api/tasks: auth first, then JSON body + Zod schema; `account_id` is taken from auth only.
 *
 * @param request - The incoming Next.js request
 * @returns Error response or {@link CreateTaskBody} with `account_id` from resolved auth context
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

  return {
    ...validationResult.data,
    account_id: authBase.accountId,
  };
}

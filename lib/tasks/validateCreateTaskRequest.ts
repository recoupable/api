import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { createTaskBodySchema, type CreateTaskBody } from "@/lib/tasks/createTaskSchemas";

/**
 * Validates POST /api/tasks: JSON + Zod first, then `validateAuthContext` with optional body `account_id`
 * override — matches the canonical validate-body-then-auth shape used by other POST endpoints.
 *
 * @param request - The incoming Next.js request
 * @returns Error response or {@link CreateTaskBody} with resolved `account_id`
 */
export async function validateCreateTaskRequest(
  request: NextRequest,
): Promise<NextResponse | CreateTaskBody> {
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

  const authContext = await validateAuthContext(request, {
    accountId: validationResult.data.account_id,
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return {
    ...validationResult.data,
    account_id: authContext.accountId,
  };
}

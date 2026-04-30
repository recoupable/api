import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import {
  updateTaskRestBodySchema,
  type UpdateTaskPersistInput,
} from "@/lib/tasks/updateTaskSchemas";

/**
 * Validates PATCH /api/tasks: JSON parse, Zod (`UpdateTaskRequest`), then `validateAuthContext`
 * with optional body `account_id` — same validate-body-then-auth shape as POST `/api/tasks`.
 *
 * @param request - The incoming Next.js request
 * @returns Error response or {@link UpdateTaskPersistInput} with `resolvedAccountId` (body `account_id` is not passed through)
 */
export async function validateUpdateTaskRequest(
  request: NextRequest,
): Promise<NextResponse | UpdateTaskPersistInput> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const validationResult = updateTaskRestBodySchema.safeParse(body);
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

  const { account_id: _accountOverride, ...patchFields } = validationResult.data;

  const authContext = await validateAuthContext(request, {
    accountId: validationResult.data.account_id,
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return {
    ...patchFields,
    resolvedAccountId: authContext.accountId,
  };
}

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { deleteTaskBodySchema } from "@/lib/tasks/validateDeleteTaskBody";

export interface DeleteTaskRequestInput {
  id: string;
  resolvedAccountId: string;
}

/**
 * Validates DELETE /api/tasks request body and auth context.
 */
export async function validateDeleteTaskRequest(
  request: NextRequest,
): Promise<NextResponse | DeleteTaskRequestInput> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const validationResult = deleteTaskBodySchema.safeParse(body);
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

  const authContext = await validateAuthContext(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  return {
    id: validationResult.data.id,
    resolvedAccountId: authContext.accountId,
  };
}

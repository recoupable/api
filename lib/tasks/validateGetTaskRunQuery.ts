import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { z } from "zod";

const getTaskRunQuerySchema = z.object({
  runId: z
    .string({ message: "runId is required" })
    .min(1, "runId is required")
    .transform(val => val.trim()),
});

export type GetTaskRunQuery = z.infer<typeof getTaskRunQuerySchema>;

/**
 * Validates auth context and query parameters for GET /api/tasks/runs.
 *
 * @param request - The NextRequest object
 * @returns A NextResponse with an error if validation fails, or the validated query if validation passes.
 */
export async function validateGetTaskRunQuery(
  request: NextRequest,
): Promise<NextResponse | GetTaskRunQuery> {
  // Validate auth context
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const runId = request.nextUrl.searchParams.get("runId") ?? "";

  const result = getTaskRunQuerySchema.safeParse({ runId });

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return result.data;
}

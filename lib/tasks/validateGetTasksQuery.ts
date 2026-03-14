import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const getTasksQuerySchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe("Optional: Filter tasks by the account ID which created them."),
  artist_account_id: z
    .string()
    .optional()
    .describe("Optional: Filter tasks by the artist account ID."),
  enabled: z.coerce.boolean().optional().describe("Optional: Filter tasks by their enabled status"),
  id: z.string().optional().describe("Optional: Filter tasks by task ID"),
});

export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>;

/**
 * Validates get tasks query parameters from a NextRequest.
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with an error if validation fails, or the validated query parameters if validation passes.
 */
export function validateGetTasksQuery(request: NextRequest): NextResponse | GetTasksQuery {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const validationResult = getTasksQuerySchema.safeParse(params);

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

  return validationResult.data;
}

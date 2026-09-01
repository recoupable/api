import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

/** Matches the `length(body) <= 4000` CHECK on project_task_comments. */
export const COMMENT_MAX_LENGTH = 4000;

export const createProjectCommentBodySchema = z.object({
  body: z
    .string({ message: "body is required" })
    .trim()
    .min(1, "body cannot be empty")
    .max(COMMENT_MAX_LENGTH, `body cannot exceed ${COMMENT_MAX_LENGTH} characters`),
});

export type CreateProjectCommentBody = z.infer<typeof createProjectCommentBodySchema>;

/**
 * Validates the body for POST /api/projects/{projectId}/tasks/{taskId}/comments.
 *
 * The length cap mirrors the database CHECK rather than trusting it: a 400
 * naming the field beats a 500 from a constraint violation.
 *
 * @param body - The request body.
 * @returns The validated body, or a 400 NextResponse naming the first problem.
 */
export function validateCreateProjectCommentBody(
  body: unknown,
): NextResponse | CreateProjectCommentBody {
  const result = createProjectCommentBodySchema.safeParse(body);

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

  return result.data;
}

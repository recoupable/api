import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createProjectTaskBodySchema = z.object({
  title: z.string({ message: "title is required" }).trim().min(1, "title cannot be empty"),
  description: z.string().trim().nullish(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must be a YYYY-MM-DD date")
    .nullish(),
  assignee_account_id: z.string().uuid("assignee_account_id must be a valid UUID").nullish(),
});

export type CreateProjectTaskBody = z.infer<typeof createProjectTaskBodySchema>;

/**
 * Validates the body for POST /api/projects/{projectId}/tasks.
 *
 * @param body - The request body.
 * @returns The validated body, or a 400 NextResponse naming the first problem.
 */
export function validateCreateProjectTaskBody(body: unknown): NextResponse | CreateProjectTaskBody {
  const result = createProjectTaskBodySchema.safeParse(body);

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

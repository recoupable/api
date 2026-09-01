import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const updateProjectTaskBodySchema = z
  .object({
    title: z.string().trim().min(1, "title cannot be empty").optional(),
    description: z.string().trim().nullish(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must be a YYYY-MM-DD date")
      .nullish(),
    assignee_account_id: z.string().uuid("assignee_account_id must be a valid UUID").nullish(),
    completed: z.boolean().optional(),
  })
  // An empty PATCH is a caller mistake, not a no-op success: silently
  // returning 200 for a body that changes nothing hides a broken client.
  .refine(body => Object.keys(body).length > 0, {
    message: "at least one field is required",
  });

export type UpdateProjectTaskBody = z.infer<typeof updateProjectTaskBodySchema>;

/**
 * Validates the body for PATCH /api/projects/{projectId}/tasks/{taskId}.
 *
 * `completed_at` and `completed_by` are deliberately not accepted: completion
 * is toggled with `completed` so the server, not the caller, decides when it
 * happened and who did it.
 *
 * @param body - The request body.
 * @returns The validated body, or a 400 NextResponse naming the first problem.
 */
export function validateUpdateProjectTaskBody(body: unknown): NextResponse | UpdateProjectTaskBody {
  const result = updateProjectTaskBodySchema.safeParse(body);

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

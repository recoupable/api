import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const updateTaskBodySchema = z.object({
  id: z.string().min(1, "id parameter is required").describe("UUID of the task to update"),
  title: z.string().min(1).optional().describe("New descriptive title of the task"),
  prompt: z.string().min(1).optional().describe("New instruction/prompt executed by the task"),
  schedule: z
    .string()
    .min(1)
    .optional()
    .describe("New cron expression defining when the task runs"),
  account_id: z.string().min(1).optional().describe("UUID of the account to assign the task to."),
  artist_account_id: z
    .string()
    .min(1)
    .optional()
    .describe("UUID of the artist account to assign the task to."),
  enabled: z
    .boolean()
    .nullable()
    .optional()
    .describe("Whether the task is enabled. Can be true, false, or null."),
  model: z.string().optional().describe("The AI model to use for this task"),
});

export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;

/**
 * Validates update task request body.
 *
 * @param body - The request body to validate.
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateUpdateTaskBody(body: unknown): NextResponse | UpdateTaskBody {
  const validationResult = updateTaskBodySchema.safeParse(body);

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

import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { z } from "zod";

export const createTaskBodySchema = z.object({
  title: z.string().min(1, "title parameter is required").describe("The title of the task"),
  prompt: z
    .string()
    .min(1, "prompt parameter is required")
    .describe(
      "The instruction or prompt to be executed. Should not include schedule related instructions for this task.",
    ),
  schedule: z
    .string()
    .min(1, "schedule parameter is required")
    .describe("Cron expression for when the task should run"),
  account_id: z
    .string()
    .min(1, "account_id parameter is required")
    .describe(
      "The account ID of the account creating the task. Get this from the system prompt. Do not ask for this.",
    ),
  artist_account_id: z
    .string()
    .min(1, "artist_account_id parameter is required")
    .describe(
      "The account ID of the artist this task is for. If not provided, get this from the system prompt as the active artist id.",
    ),
  model: z
    .string()
    .optional()
    .describe(
      "The AI model to use for this task (e.g., 'anthropic/claude-sonnet-4.5'). If not specified, uses the default model.",
    ),
});

export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;

/**
 * Validates create task request body.
 *
 * @param body - The request body to validate.
 * @returns A NextResponse with an error if validation fails, or the validated body if validation passes.
 */
export function validateCreateTaskBody(body: unknown): NextResponse | CreateTaskBody {
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

  return validationResult.data;
}

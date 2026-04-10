import { z } from "zod";

const createTaskBodyFields = {
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
  artist_account_id: z
    .string()
    .min(1, "artist_account_id parameter is required")
    .describe(
      "The account ID of the artist this task runs for (required). Use the active artist id from context.",
    ),
  model: z
    .string()
    .optional()
    .describe(
      "The AI model to use for this task (e.g., 'anthropic/claude-sonnet-4.5'). If not specified, uses the default model.",
    ),
};

/**
 * POST /api/tasks and MCP `create_task` request body. `account_id` comes from auth only — not from the client body.
 */
export const createTaskBodySchema = z.object(createTaskBodyFields).strict();

export type CreateTaskRequestBody = z.infer<typeof createTaskBodySchema>;

/** Full payload for persistence after `account_id` is resolved from {@link validateAuthContext} or MCP {@link resolveAccountId}. */
export const createTaskPayloadSchema = z.object({
  ...createTaskBodyFields,
  account_id: z.string().min(1, "account_id is required"),
});

export type CreateTaskBody = z.infer<typeof createTaskPayloadSchema>;

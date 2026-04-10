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

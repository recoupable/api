import { z } from "zod";

/**
 * Zod schemas for POST /api/tasks and MCP `create_task`, aligned with `CreateTaskRequest` in OpenAPI.
 * HTTP validation flow: `validateCreateTaskRequest.ts`; MCP uses `resolveAccountId` then `createTask`.
 */

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
    .describe("UUID of the associated artist account"),
  account_id: z
    .string()
    .uuid("account_id must be a valid UUID")
    .optional()
    .describe(
      "UUID of the account to create the task for. Only applicable when the authenticated account has access to multiple accounts via organization membership. If omitted, the task is created for the authenticated account.",
    ),
  model: z
    .string()
    .optional()
    .describe("Optional AI model id for this task. If omitted, the default model is used."),
};

/**
 * Request body for REST `POST /api/tasks`. Optional `account_id` is authorized via `validateAccountIdOverride`.
 */
export const createTaskBodySchema = z.object(createTaskBodyFields).strict();

export type CreateTaskRequestBody = z.infer<typeof createTaskBodySchema>;

/**
 * MCP `create_task` tool input: same task fields as REST **except** no `account_id` — MCP runs in the authenticated user’s personal context only; account is taken from MCP auth.
 */
export const mcpCreateTaskBodySchema = createTaskBodySchema.omit({ account_id: true });

export type McpCreateTaskRequestBody = z.infer<typeof mcpCreateTaskBodySchema>;

/** Resolved payload for persistence (`account_id` is always set after auth + override checks). */
export const createTaskPayloadSchema = createTaskBodySchema.omit({ account_id: true }).extend({
  account_id: z.string().min(1, "account_id is required"),
});

export type CreateTaskBody = z.infer<typeof createTaskPayloadSchema>;

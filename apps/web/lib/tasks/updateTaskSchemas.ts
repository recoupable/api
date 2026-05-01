import { z } from "zod";

/**
 * PATCH /api/tasks JSON body aligned with OpenAPI `UpdateTaskRequest`:
 * strict object, UUID formats, optional fields non-empty where sent.
 */

export const updateTaskRestBodySchema = z
  .object({
    id: z.string().uuid("id must be a valid UUID"),
    title: z.string().min(1, "title must be a non-empty string").optional(),
    prompt: z.string().min(1, "prompt must be a non-empty string").optional(),
    schedule: z.string().min(1, "schedule must be a non-empty string").optional(),
    account_id: z
      .string()
      .uuid("account_id must be a valid UUID")
      .optional()
      .describe(
        "Account context for org/API-key rules; authorized via validateAuthContext. Not a raw column override.",
      ),
    artist_account_id: z.string().uuid("artist_account_id must be a valid UUID").optional(),
    enabled: z.boolean().nullable().optional(),
    model: z.string().min(1, "model must be a non-empty string").optional(),
  })
  .strict();

export type UpdateTaskRestBody = z.infer<typeof updateTaskRestBodySchema>;

/**
 * MCP `update_task`: same fields as REST except no `account_id` (personal context via auth).
 */
export const mcpUpdateTaskBodySchema = updateTaskRestBodySchema.omit({ account_id: true });

export type McpUpdateTaskRequestBody = z.infer<typeof mcpUpdateTaskBodySchema>;

/**
 * Persist step: optional body `account_id` has been stripped; `resolvedAccountId` is enforced owner check.
 */
export const updateTaskPersistInputSchema = updateTaskRestBodySchema
  .omit({ account_id: true })
  .extend({
    resolvedAccountId: z.string().uuid(),
  });

export type UpdateTaskPersistInput = z.infer<typeof updateTaskPersistInputSchema>;

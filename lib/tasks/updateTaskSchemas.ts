import { z } from "zod";
import { isValidTimeZone } from "@/lib/tasks/timezone/isValidTimeZone";

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
    timezone: z
      .string()
      .refine(isValidTimeZone, "timezone must be a valid IANA time zone")
      .optional()
      .describe(
        "Optional IANA time zone the cron is interpreted in (DST-aware). Applied to the Trigger.dev schedule; a timezone-only change re-syncs the schedule.",
      ),
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

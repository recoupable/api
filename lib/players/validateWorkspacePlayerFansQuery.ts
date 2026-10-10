import { z } from "zod";
export const workspacePlayerFansQuerySchema = z
  .object({
    organizationId: z.string().uuid().nullable().default(null),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export function validateWorkspacePlayerFansQuery(input: unknown) {
  return workspacePlayerFansQuerySchema.parse(input);
}

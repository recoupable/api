import { z } from "zod";

export const workspaceSelectionSchema = z.discriminatedUnion("workspace_kind", [
  z.object({ workspace_kind: z.literal("personal") }).strict(),
  z
    .object({
      workspace_kind: z.literal("organization"),
      organization_id: z
        .string()
        .uuid()
        .transform(value => value.toLowerCase()),
    })
    .strict(),
]);

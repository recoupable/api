import { z } from "zod";

/** Immutable consent contract. Capability additions require a new version and fresh approval. */
export const selectedContextSchema = z
  .object({
    version: z.literal(1),
    capabilityVersion: z.literal("context-workspace-v1"),
    mode: z.literal("selected_context"),
    kind: z.enum(["personal", "organization"]),
    ownerId: z
      .string()
      .uuid()
      .transform(value => value.toLowerCase()),
    organizationId: z
      .string()
      .uuid()
      .transform(value => value.toLowerCase())
      .nullable(),
  })
  .strict()
  .refine(value =>
    value.kind === "personal"
      ? value.organizationId === null
      : value.organizationId === value.ownerId,
  );

export type SelectedContext = z.infer<typeof selectedContextSchema>;

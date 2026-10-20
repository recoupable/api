import { z } from "zod";

const uuid = z.uuid().transform(value => value.toLowerCase());
export const materialRequest = z.object({
  id: uuid,
  owner_id: uuid,
  created_by: uuid,
  status: z.string(),
  input: z.object({
    kind: z.literal("material"),
    materialType: z.literal("text"),
    title: z.string().min(2).max(200),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  output: z.object({ subjectIds: z.array(uuid).length(1) }).nullish(),
});
export const materialTarget = z.object({
  subjectId: uuid,
  kind: z.literal("material"),
  identityConfirmed: z.literal(false),
});
export const materialDocument = z.object({
  id: uuid,
  ownerId: uuid,
  subjectId: uuid,
  resultId: uuid,
  topic: z.literal("material_input"),
  version: z.number().int().positive(),
  status: z.literal("accepted"),
  evidenceKind: z.literal("customer_assertion"),
  text: z.string(),
  sourceVersionIds: z.array(uuid).length(1),
  sources: z.array(z.object({ versionId: uuid })).length(1),
});
export const materialContent = z.object({
  title: z.string(),
  text: z.string().min(1).max(20000),
  contentHash: z.string(),
  submittedBy: uuid,
  scope: z.literal("workspace_private"),
  instructionsAreData: z.literal(true),
  subjectLinked: z.literal(false),
});

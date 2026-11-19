import { z } from "zod";
const uuid = z.uuid().refine(value => value === value.toLowerCase());
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const method = {
  recipe: "catalog-retained-stream-fields/1",
  recipeHash: "65a06a785aa496e1232fe3a9f1606595f19c1a152b710ca30c4c06612f01864a",
  evaluatorSha256: "163563e15dd92d473aa51899c54c96300f20d27072b83e39ffb01c84f3adc64e",
  helperSha256: "91dcca66c8dec0851c1f6e110257a63b730e9b7ae33a60bceb0e9ffcf318dd81",
} as const;
export const selectionSchema = z.strictObject({
  ownerId: uuid,
  requestId: uuid,
  subjectId: uuid,
  catalogId: uuid,
  resultId: uuid,
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  topic: z.literal("catalog_retained_streams"),
  sourceVersionIds: z.tuple([uuid]),
});
export const commandScopeSchema = z.strictObject({
  actorId: uuid,
  workspaceId: uuid,
  requestId: uuid,
  catalogId: uuid,
  key: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
});
export const receiptSchema = z.strictObject({
  ownerId: uuid,
  requestId: uuid,
  subjectId: uuid,
  catalogId: uuid,
  resultId: uuid,
  sourceVersionId: uuid,
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  key: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  commandDigest: hash,
});
export const actorScopeSchema = z.strictObject({
  actorId: uuid,
  sessionId: z.string().min(1).max(128),
  chatId: z.string().min(1).max(128),
  messageId: z.string().min(1).max(128),
});
export const requestSchema = z
  .strictObject({
    mode: z.literal("retained_field"),
    workspaceId: uuid,
    catalogId: uuid,
    field: z.literal("current_streams"),
    query: z.strictObject({
      since: z.iso.date(),
      days: z.number().int().min(1).max(366),
      timezone: z.literal("UTC"),
    }),
    method: z.strictObject({
      recipe: z.literal(method.recipe),
      recipeHash: z.literal(method.recipeHash),
      evaluatorSha256: z.literal(method.evaluatorSha256),
      helperSha256: z.literal(method.helperSha256),
    }),
    selections: z.array(selectionSchema).min(1).max(8),
  })
  .refine(
    q =>
      q.selections.every(s => s.ownerId === q.workspaceId && s.catalogId === q.catalogId) &&
      new Set(q.selections.map(s => s.subjectId)).size === q.selections.length,
  );
export type Selection = z.infer<typeof selectionSchema>;
export type CommandScope = z.infer<typeof commandScopeSchema>;
export type ActorScope = z.infer<typeof actorScopeSchema>;

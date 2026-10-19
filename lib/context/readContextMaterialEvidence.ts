import { z } from "zod";

const uuid = z.uuid().transform(value => value.toLowerCase());
const materialRequest = z.object({
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
const materialTarget = z.object({
  subjectId: uuid,
  kind: z.literal("material"),
  identityConfirmed: z.literal(false),
});
const materialDocument = z.object({
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
const materialContent = z.object({
  title: z.string(),
  text: z.string().min(1).max(20000),
  contentHash: z.string(),
  submittedBy: uuid,
  scope: z.literal("workspace_private"),
  instructionsAreData: z.literal(true),
  subjectLinked: z.literal(false),
});
const unavailable = { state: "unavailable" } as const;
const failure = () => new Error("Material evidence could not be verified");

/** Read the current retained text-version receipt; never expose text or infer file origin. */
export async function readContextMaterialEvidence(input: {
  ownerId: string;
  requestId: string;
  request: unknown;
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}) {
  const kind = z.object({ input: z.object({ kind: z.literal("material") }) });
  if (!kind.safeParse(input.request).success) return undefined;
  const saved = materialRequest.safeParse(input.request);
  if (
    !saved.success ||
    saved.data.id !== input.requestId.toLowerCase() ||
    saved.data.owner_id !== input.ownerId.toLowerCase()
  )
    throw failure();
  const request = saved.data;
  if (!["partial", "completed"].includes(request.status)) return unavailable;
  if (!request.output) throw failure();
  const scope = { p_owner: input.ownerId, p_request: input.requestId };
  const target = materialTarget.safeParse(
    await input.rpc("list_context_material_request_target", scope),
  );
  if (!target.success || target.data.subjectId !== request.output.subjectIds[0]) throw failure();
  const loaded = z
    .array(materialDocument)
    .max(1)
    .safeParse(await input.rpc("read_context_documents", scope));
  if (!loaded.success) throw failure();
  if (!loaded.data.length) return unavailable;
  const document = loaded.data[0];
  if (
    document.ownerId !== request.owner_id ||
    document.subjectId !== target.data.subjectId ||
    document.sourceVersionIds[0] !== document.sources[0].versionId
  )
    throw failure();
  let value: unknown;
  try {
    value = JSON.parse(document.text);
  } catch {
    throw failure();
  }
  const content = materialContent.safeParse(value);
  if (
    !content.success ||
    content.data.contentHash !== request.input.contentHash ||
    content.data.title !== request.input.title ||
    content.data.submittedBy !== request.created_by
  )
    throw failure();
  return {
    state: "available" as const,
    request_id: request.id,
    material_subject_id: document.subjectId,
    document_id: document.id,
    document_version: document.version,
    result_id: document.resultId,
    source_version_ids: document.sourceVersionIds,
    evidence_kind: "customer_assertion" as const,
    draft_origin: { state: "not_recorded" as const },
  };
}

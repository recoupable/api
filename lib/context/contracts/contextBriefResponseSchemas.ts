import { z } from "zod";

const purpose = z.enum(["creative_direction", "playlist_pitch", "company_onboarding"]);
// selectContextDocuments / compileContextBrief return saved evidence, not new model output.
const document = z.strictObject({
  id: z.uuid(),
  resultId: z.uuid().optional(),
  ownerId: z.uuid(),
  subjectId: z.uuid(),
  topic: z.string(),
  version: z.number(),
  status: z.literal("accepted"),
  evidenceKind: z.enum(["observation", "estimate", "interpretation", "customer_assertion"]),
  text: z.string(),
  sourceVersionIds: z.array(z.uuid()),
  coverage: z.enum(["full", "partial"]),
  sources: z
    .array(
      z.strictObject({ versionId: z.uuid(), url: z.string().nullable(), retrievedAt: z.string() }),
    )
    .nullable()
    .optional(),
});
export const contextBriefResponseSchema = z.strictObject({
  assessment_scope: z.literal("selected_saved_context_requests").optional(),
  next_steps: z
    .array(
      z.strictObject({
        requestId: z.uuid(),
        action: z.enum(["review_assessment_coverage", "review_available_evidence"]),
        topics: z.array(z.string()),
      }),
    )
    .optional(),
  request_id: z.uuid(),
  request_ids: z.array(z.uuid()),
  purpose,
  readiness: z.enum(["partial", "ready"]),
  text: z.string(),
  text_characters: z.number().int().nonnegative(),
  documents: z.array(document),
  characters: z.number().int().nonnegative(),
  missingTopics: z.array(z.string()),
  gaps: z.array(
    z.strictObject({
      requestId: z.uuid(),
      topic: z.string(),
      subjectId: z.uuid().nullable(),
      status: z.string(),
      reason: z.string(),
    }),
  ),
  guidance: z.string(),
  request_coverage: z.array(
    z.strictObject({
      requestId: z.uuid(),
      readiness: z.enum(["partial", "ready"]),
      missingTopics: z.array(z.string()),
    }),
  ),
  input_manifest: z.strictObject({
    compilerVersion: z.literal("context-brief-v1"),
    method: z.literal("saved_evidence_selection"),
    requestIds: z.array(z.uuid()),
    excludedTopics: z.array(z.string()),
    documents: z.array(
      z.strictObject({
        documentId: z.uuid(),
        resultId: z.uuid().nullable(),
        subjectId: z.uuid(),
        topic: z.string(),
        version: z.number(),
        sourceVersionIds: z.array(z.uuid()),
      }),
    ),
  }),
});
export const contextBriefSnapshotSchema = z.strictObject({
  snapshot: z.discriminatedUnion("state", [
    z.strictObject({
      id: z.uuid(),
      created_at: z.string(),
      purpose,
      state: z.literal("saved"),
      superseded: z.boolean(),
      brief: contextBriefResponseSchema,
    }),
    z.strictObject({
      id: z.uuid(),
      created_at: z.string(),
      purpose,
      state: z.literal("unavailable"),
      superseded: z.boolean(),
      brief: z.null(),
    }),
  ]),
});
export const contextMaterialEvidenceSchema = z
  .union([
    z.strictObject({ state: z.literal("unavailable") }),
    z.strictObject({
      state: z.literal("available"),
      request_id: z.uuid(),
      material_subject_id: z.uuid(),
      document_id: z.uuid(),
      document_version: z.number(),
      result_id: z.uuid(),
      source_version_ids: z.array(z.uuid()),
      evidence_kind: z.literal("customer_assertion"),
      draft_origin: z.strictObject({ state: z.literal("not_recorded") }),
    }),
  ])
  .describe(
    "Metadata-only material receipt on HTTP/standard MCP reads; omitted on delegated OAuth reads. No submitted text or file location is returned.",
  );

import { z } from "zod";
import { contextReleaseFormatSchema } from "./contextReleaseFormatSchema";

// Existing releaseCaseEvidenceTypes / release-track read and identity-review RPCs.
export const contextReleaseTrackPageSchema = z.strictObject({
  state: z.enum(["ready", "not_collected", "needs_reconciliation"]),
  releaseId: z.string(),
  sourceResultId: z.uuid().optional(),
  coverage: z.string().nullable().optional(),
  collectedSlots: z.number().int().optional(),
  reportedTotal: z.number().int().nullable().optional(),
  linkedSlots: z.number().int().optional(),
  unavailableSlots: z.number().int().optional(),
  slots: z.array(
    z.strictObject({
      slotIndex: z.number().int(),
      spotifyTrackId: z.string(),
      discNumber: z.number().int().nullable(),
      trackNumber: z.number().int().nullable(),
      sourceResultId: z.uuid(),
    }),
  ),
  nextCursor: z.number().int().nullable(),
  hasMore: z.boolean(),
});
export const contextReleaseIdentityReviewSchema = z
  .strictObject({
    state: z.enum(["ready", "not_collected", "needs_reconciliation", "unsupported"]),
    releaseSourceResultId: z.uuid().optional(),
    resultId: z.uuid().optional(),
    coverage: z.string().nullable().optional(),
    candidates: z.array(
      z.strictObject({
        slotIndex: z.number().int(),
        spotifyTrackId: z.string(),
        observationState: z.enum(["observed", "missing_isrc", "failed"]),
        isrc: z.string().nullable(),
        mappingState: z.enum(["conflict", "existing_identifier_match", "unmapped", "unresolved"]),
      }),
    ),
  })
  .describe(
    "Saved identity observations and existing mappings; candidates do not confirm recording identity, rights or ownership.",
  );

export const contextReleaseTrackObservationsSchema = z.union([
  z.strictObject({
    state: z.enum(["not_collected", "needs_reconciliation"]),
    releaseSourceResultId: z.uuid().nullable(),
  }),
  z.strictObject({
    state: z.literal("ready"),
    resultId: z.uuid(),
    releaseSourceResultId: z.uuid(),
    coverage: z.enum(["full", "partial"]),
    observedIsrcCount: z.number().int().nonnegative(),
    missingIsrcCount: z.number().int().nonnegative(),
    failedLookupCount: z.number().int().nonnegative(),
    slots: z
      .array(
        z.strictObject({
          slotIndex: z.number().int().nonnegative(),
          spotifyTrackId: z.string(),
          state: z.enum(["observed", "missing_isrc", "failed"]),
          isrc: z.string().nullable(),
        }),
      )
      .max(100),
    observations: z
      .array(
        z.strictObject({
          spotifyTrackId: z.string(),
          state: z.enum(["observed", "missing_isrc", "failed"]),
          isrc: z.string().nullable(),
          sourceUrl: z.url(),
          retrievedAt: z.string(),
          elapsedMs: z.number().nonnegative(),
          httpStatus: z.number().int().nullable(),
          gap: z.string().nullable(),
        }),
      )
      .max(100),
    sources: z.array(
      z.strictObject({ versionId: z.uuid(), url: z.url(), retrievedAt: z.string() }),
    ),
  }),
]);

const releaseCaseBody = z.strictObject({
  contract_version: z.literal("release-case-v1"),
  operation: z.literal("release_metadata_reconciliation"),
  request_id: z.uuid(),
  subject_id: z.uuid(),
  title: z.string().nullable(),
  release_url: z.string().nullable(),
  release_format: contextReleaseFormatSchema.optional(),
  readiness: z.enum(["partial", "blocked"]),
  tracks: z.array(
    z.strictObject({
      slot_index: z.number().int(),
      spotify_track_id: z.string(),
      title: z.string().nullable(),
      disc_number: z.number().int().nullable(),
      track_number: z.number().int().nullable(),
      credited_artists: z.array(
        z.strictObject({ name: z.string().nullable(), spotify_artist_id: z.string().nullable() }),
      ),
    }),
  ),
  track_page: contextReleaseTrackPageSchema,
  identity_observations: contextReleaseIdentityReviewSchema,
  evidence_manifest: z.array(
    z.strictObject({
      document_id: z.uuid(),
      document_revision: z.number().int(),
      result_id: z.uuid(),
      source_version_id: z.uuid(),
      source_url: z.string().nullable(),
      retrieved_at: z.string(),
    }),
  ),
  gaps: z.array(z.string()),
  reviewable: z.boolean(),
  capabilities: z.strictObject({
    distribute: z.literal("unsupported"),
    register_rights: z.literal("unsupported"),
    collect_royalties: z.literal("unsupported"),
  }),
  cost: z.strictObject({
    provider_calls: z.literal(0),
    model_calls: z.literal(0),
    infrastructure_cost: z.literal("unmeasured"),
  }),
  fingerprint: z.string(),
});
export const contextReleaseCaseSchema = releaseCaseBody.extend({
  latest_review: z
    .strictObject({
      id: z.uuid(),
      decision: z.string(),
      created_at: z.string(),
      stale: z.boolean(),
    })
    .nullable(),
});
export const contextReleaseCaseListSchema = z.strictObject({
  cases: z.array(
    z.strictObject({
      request_id: z.uuid(),
      url: z.string(),
      created_at: z.string(),
      status: z.string(),
    }),
  ),
  has_more: z.boolean(),
  next_id: z.uuid().nullable(),
});
export const contextReleaseCaseReviewSchema = z.discriminatedUnion("state", [
  z.strictObject({
    id: z.uuid(),
    created_at: z.string(),
    actor_id: z.uuid(),
    decision: z.enum(["reviewed", "needs_changes"]),
    policy_version: z.string(),
    state: z.literal("saved"),
    stale: z.boolean(),
    snapshot: releaseCaseBody,
    note: z.string().nullable(),
  }),
  z.strictObject({
    id: z.uuid(),
    created_at: z.string(),
    actor_id: z.uuid(),
    decision: z.enum(["reviewed", "needs_changes"]),
    policy_version: z.string(),
    state: z.literal("unavailable"),
    stale: z.null(),
    snapshot: z.null(),
    note: z.null(),
  }),
]);

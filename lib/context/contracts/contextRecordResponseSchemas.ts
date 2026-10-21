import { z } from "zod";

// Persisted jsonb is deliberately flexible, including historical scalar/array values.
const retainedJson = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

// context_requests Row / read_context_request: claim_token is explicitly withheld.
export const contextRequestRecordSchema = z.strictObject({
  id: z.uuid(),
  owner_id: z.uuid(),
  created_by: z.uuid(),
  resource_id: z.uuid(),
  idempotency_key: z.string().min(1).max(128),
  input_fingerprint: z.string().length(64),
  input: retainedJson.describe(
    "Retained JSON input; current ingestion writes normalized objects, while historical JSON remains readable. Submitted names/text remain assertions.",
  ),
  status: z.enum(["queued", "running", "partial", "completed", "failed", "cancelled"]),
  workflow_id: z.string().nullable(),
  revision: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
  lease_expires_at: z.string().nullable(),
  output: retainedJson.describe(
    "Retained action-specific JSON (for example subjectIds and gaps), including historical scalar/array values; not a guarantee of complete evidence.",
  ),
  error: z.string().nullable(),
});

export const contextModuleNodeSchema = z.strictObject({
  key: z.string(),
  entry: z.enum([
    "artist",
    "songwriter",
    "company",
    "campaign",
    "release",
    "song",
    "catalog",
    "material",
  ]),
  subjectId: z.uuid(),
  targetKind: z.enum([
    "artist",
    "songwriter",
    "company",
    "campaign",
    "release",
    "recording",
    "composition",
    "catalog",
    "material",
  ]),
  module: z.enum([
    "musicbrainz",
    "mlc_recording",
    "mlc_search",
    "mlc_work",
    "songstats",
    "saved_socials",
    "catalog_valuation",
    "company_research",
    "campaign_context",
    "release_expansion",
    "spotify_release",
    "material_extraction",
    "songwriter_research",
  ]),
  executor: z.string().nullable(),
  state: z.enum(["blocked", "not_implemented"]),
  reasons: z.array(z.string()),
  dependsOn: z.array(z.string()),
  scope: z.literal("workspace_private"),
  executionStarted: z.literal(false),
});
export const contextModulePlanSchema = z.strictObject({
  requestId: z.uuid(),
  entry: contextModuleNodeSchema.shape.entry,
  plan: z.array(contextModuleNodeSchema).max(100),
  collectionPermitted: z.literal(false),
});

export const contextExecutionSchema = z.strictObject({
  id: z.uuid(),
  owner_id: z.uuid(),
  request_id: z.uuid(),
  policy_version: z.string(),
  created_at: z.string(),
  plan: z
    .array(
      z.looseObject({
        key: z.string(),
        subjectId: z.uuid(),
        module: z.string(),
        state: z.enum(["ready_for_dispatch", "reuse_candidate", "blocked", "not_implemented"]),
        dependsOn: z.array(z.string()),
      }),
    )
    .max(100)
    .describe(
      "Immutable saved plan; reading it never grants execution or retry permission. Other stored node metadata is preserved.",
    ),
  outcomes: z.array(
    z.strictObject({
      execution_id: z.uuid(),
      owner_id: z.uuid(),
      node_key: z.string(),
      recorded_at: z.string(),
      outcome: z
        .looseObject({ status: z.enum(["saved", "reused", "failed", "blocked"]) })
        .describe(
          "Stored outcome JSON; optional receipt/reason fields depend on the node. Success is saved evidence, not verified rights.",
        ),
    }),
  ),
  claims: z
    .array(
      z.strictObject({
        nodeKey: z.string(),
        claimedAt: z.string(),
        state: z.enum(["saved", "reused", "failed", "blocked", "unknown"]),
      }),
    )
    .describe("A claim with no outcome is unknown; reading does not retry or reconcile it."),
});
export const contextExecutionListSchema = z.strictObject({
  executions: z.array(
    z.strictObject({
      executionId: z.uuid(),
      policyVersion: z.string().min(1).max(100),
      createdAt: z.string(),
      nodeCount: z.number().int().min(0).max(100),
      outcomeCount: z.number().int().min(0).max(100),
    }),
  ),
});
export const contextCatalogMembersSchema = z.strictObject({
  page: z.strictObject({
    catalogId: z.uuid(),
    subjectId: z.uuid(),
    members: z.array(z.string().min(1).max(100)).max(100),
    nextCursor: z.string().min(1).max(100).nullable(),
    hasMore: z.boolean(),
  }),
});
export const contextCatalogExpansionSchema = z.strictObject({
  page: z.strictObject({
    catalogId: z.uuid(),
    catalogSubjectId: z.uuid(),
    members: z
      .array(z.strictObject({ subjectId: z.uuid(), isrc: z.string().min(1).max(100) }))
      .max(100),
    nextCursor: z.string().min(1).max(100).nullable(),
    hasMore: z.boolean(),
  }),
});

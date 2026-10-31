import { catalogCaseReceiptSchema, catalogCasePageSchema } from "../catalogCaseResponseSchemas";
import { z } from "zod";
import type { contextOperationSchema } from "../processContextOperation";
import { catalogPlanningResponseSchema } from "../catalogPlanningResponseSchema";
import {
  contextBriefResponseSchema,
  contextBriefSnapshotSchema,
  contextMaterialEvidenceSchema,
} from "./contextBriefResponseSchemas";
import {
  contextRequestRecordSchema,
  contextModulePlanSchema,
  contextExecutionSchema,
  contextExecutionListSchema,
  contextCatalogMembersSchema,
  contextCatalogExpansionSchema,
} from "./contextRecordResponseSchemas";
import {
  contextReleaseTrackPageSchema,
  contextReleaseIdentityReviewSchema,
  contextReleaseTrackObservationsSchema,
  contextReleaseCaseSchema,
  contextReleaseCaseListSchema,
  contextReleaseCaseReviewSchema,
} from "./contextReleaseResponseSchemas";

/** Source-described responses only: this registry is not runtime validation or permission. */
export const contextResponseSchemas = {
  catalogCase: catalogCaseReceiptSchema,
  catalogCases: catalogCasePageSchema,
  catalogPlanning: catalogPlanningResponseSchema,
  request: z.strictObject({ request: contextRequestRecordSchema }),
  read: z.strictObject({
    request: contextRequestRecordSchema,
    material_evidence: contextMaterialEvidenceSchema.optional(),
  }),
  brief: contextBriefResponseSchema,
  briefSnapshot: contextBriefSnapshotSchema,
  modulePlan: contextModulePlanSchema,
  execution: z.strictObject({ execution: contextExecutionSchema }),
  executions: contextExecutionListSchema,
  catalogMembers: contextCatalogMembersSchema,
  catalogExpansion: contextCatalogExpansionSchema,
  releaseTracks: z.strictObject({ page: contextReleaseTrackPageSchema }),
  releaseTrackObservations: z.strictObject({ observation: contextReleaseTrackObservationsSchema }),
  releaseIdentityReview: z.strictObject({ review: contextReleaseIdentityReviewSchema }),
  releaseVerification: z
    .strictObject({ request_id: z.uuid(), verificationQueued: z.literal(true) })
    .describe(
      "202 only after the existing feature/readiness checks and dispatch succeed; not verification completion.",
    ),
  releaseTrackVerification: z
    .strictObject({ request_id: z.uuid(), subject_id: z.uuid(), lookupQueued: z.literal(true) })
    .describe(
      "202 only after the existing feature/readiness checks and dispatch succeed; no automatic identity confirmation.",
    ),
  releaseCase: contextReleaseCaseSchema,
  releaseCases: contextReleaseCaseListSchema,
  releaseCaseReview: contextReleaseCaseReviewSchema,
};

type Action = z.infer<typeof contextOperationSchema>["action"];
type Reference =
  | `#/responseSchemas/${keyof typeof contextResponseSchemas}`
  | "#/evidenceSchemas/receipt"
  | "#/evidenceSchemas/page";
export const contextResponseReferences = {
  save_catalog_case: "#/responseSchemas/catalogCase",
  read_catalog_case: "#/responseSchemas/catalogCase",
  list_catalog_cases: "#/responseSchemas/catalogCases",
  attach_evidence: "#/evidenceSchemas/receipt",
  read_evidence_attachment: "#/evidenceSchemas/receipt",
  list_evidence_attachments: "#/evidenceSchemas/page",
  list_release_cases: "#/responseSchemas/releaseCases",
  read_release_case: "#/responseSchemas/releaseCase",
  read_release_case_review: "#/responseSchemas/releaseCaseReview",
  review_release_case: "#/responseSchemas/releaseCaseReview",
  save_brief: "#/responseSchemas/briefSnapshot",
  read_brief: "#/responseSchemas/briefSnapshot",
  plan: "#/responseSchemas/modulePlan",
  list_executions: "#/responseSchemas/executions",
  list_catalog_members: "#/responseSchemas/catalogMembers",
  list_release_tracks: "#/responseSchemas/releaseTracks",
  read_release_track_observations: "#/responseSchemas/releaseTrackObservations",
  review_release_track_identities: "#/responseSchemas/releaseIdentityReview",
  verify_release_tracks: "#/responseSchemas/releaseTrackVerification",
  expand_catalog_members: "#/responseSchemas/catalogExpansion",
  plan_catalog_members: "#/responseSchemas/catalogPlanning",
  read_execution: "#/responseSchemas/execution",
  ingest_catalog: "#/responseSchemas/request",
  ingest_artist: "#/responseSchemas/request",
  ingest_songwriter_name: "#/responseSchemas/request",
  ingest_company_name: "#/responseSchemas/request",
  ingest_campaign_brief: "#/responseSchemas/request",
  ingest_supporting_text: "#/responseSchemas/request",
  ingest_release: "#/responseSchemas/request",
  verify_release: "#/responseSchemas/releaseVerification",
  ingest: "#/responseSchemas/request",
  read: "#/responseSchemas/read",
  brief: "#/responseSchemas/brief",
} as const satisfies Record<Action, Reference>;

export const contextResponseStatusCodes = Object.fromEntries(
  Object.keys(contextResponseReferences).map(action => [
    action,
    ["ingest", "verify_release", "verify_release_tracks"].includes(action) ? 202 : 200,
  ]),
) as Record<Action, 200 | 202>;

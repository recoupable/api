import { z } from "zod";
import { selectedBriefEvidenceSchema } from "./selectedBriefEvidenceSchema";
import { catalogCaseOperationSchemas } from "./catalogCaseOperationSchemas";
import { releaseCaseOperationSchemas } from "./releaseCaseOperationSchemas";
import { evidenceAttachmentOperationSchemas } from "./evidenceAttachmentSchemas";
import { contextIngestSchema } from "./schema";
import { catalogPlanningModuleMap } from "./normalizeCatalogPlanningModule";

const briefFields = {
  request_id: z.uuid(),
  additional_request_ids: z.array(z.uuid()).max(9).default([]),
  organization_id: z.uuid().optional(),
  purpose: z.enum(["creative_direction", "playlist_pitch", "company_onboarding"]),
  max_characters: z.number().int().min(1000).max(32000).default(12000),
};

export const contextOperationSchema = z.discriminatedUnion("action", [
  ...catalogCaseOperationSchemas,
  ...evidenceAttachmentOperationSchemas,
  ...releaseCaseOperationSchemas,
  z.strictObject({
    action: z.literal("save_brief"),
    ...briefFields,
    idempotency_key: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/),
  }),
  z
    .strictObject({
      action: z.literal("read_brief"),
      brief_id: z.uuid(),
      selected_evidence: selectedBriefEvidenceSchema.optional(),
      explain_evidence_validation: z.boolean().optional(),
      organization_id: z.uuid().optional(),
    })
    .refine(args => !args.explain_evidence_validation || !!args.selected_evidence, {
      message: "explain_evidence_validation requires selected_evidence",
      path: ["explain_evidence_validation"],
    }),
  z.strictObject({
    action: z.literal("plan"),
    request_id: z.string().uuid(),
    organization_id: z.string().uuid().optional(),
  }),
  z.strictObject({
    action: z.literal("list_executions"),
    request_id: z.string().uuid(),
    organization_id: z.string().uuid().optional(),
  }),
  z.strictObject({
    action: z.literal("list_catalog_members"),
    request_id: z.string().uuid(),
    subject_id: z.string().uuid(),
    organization_id: z.string().uuid().optional(),
    after_isrc: z.string().min(1).max(100).optional(),
    limit: z.number().int().min(1).max(100).default(100),
  }),
  z.strictObject({
    action: z.literal("list_release_tracks"),
    request_id: z.uuid(),
    subject_id: z.uuid(),
    organization_id: z.uuid().optional(),
    after_slot: z.number().int().min(-1).default(-1),
    limit: z.number().int().min(1).max(100).default(100),
  }),
  z.strictObject({
    action: z.literal("read_release_track_observations"),
    request_id: z.uuid(),
    subject_id: z.uuid(),
    organization_id: z.uuid().optional(),
  }),
  z.strictObject({
    action: z.literal("review_release_track_identities"),
    request_id: z.uuid(),
    subject_id: z.uuid(),
    organization_id: z.uuid().optional(),
  }),
  z.strictObject({
    action: z.literal("verify_release_tracks"),
    request_id: z.uuid(),
    subject_id: z.uuid(),
    organization_id: z.uuid().optional(),
  }),
  z.strictObject({
    action: z.literal("expand_catalog_members"),
    request_id: z.string().uuid(),
    subject_id: z.string().uuid(),
    organization_id: z.string().uuid().optional(),
    after_isrc: z.string().min(1).max(100).optional(),
    limit: z.number().int().min(1).max(100).default(100),
  }),
  z.strictObject({
    action: z.literal("plan_catalog_members"),
    request_id: z.string().uuid(),
    subject_id: z.string().uuid(),
    organization_id: z.string().uuid().optional(),
    after_isrc: z.string().min(1).max(100).optional(),
    limit: z.number().int().min(1).max(100).default(100),
    module: z
      .enum(Object.keys(catalogPlanningModuleMap) as (keyof typeof catalogPlanningModuleMap)[])
      .describe(
        "Use recording_candidates for unconfirmed recording matches, recording_work_candidates for candidate linked works (not ownership), or platform_metadata for available platform track information (not growth metrics). Legacy musicbrainz, mlc_recording and songstats remain accepted. Planning only; returned module IDs retain legacy values and collection is not permitted.",
      ),
  }),
  z.strictObject({
    action: z.literal("read_execution"),
    execution_id: z.string().uuid(),
    organization_id: z.string().uuid().optional(),
  }),
  z.strictObject({
    action: z.literal("ingest_catalog"),
    catalog_id: z.string().uuid(),
    organization_id: z.string().uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
  z.strictObject({
    action: z.literal("ingest_artist"),
    artist_id: z.uuid(),
    organization_id: z.uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
  z.strictObject({
    action: z.literal("ingest_songwriter_name"),
    name: z.string().trim().min(2).max(200),
    organization_id: z.uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
  z.strictObject({
    action: z.literal("ingest_company_name"),
    name: z.string().trim().min(2).max(200),
    organization_id: z.uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
  z.strictObject({
    action: z.literal("ingest_campaign_brief"),
    brief: z
      .strictObject({
        name: z.string().trim().min(2).max(200),
        goal: z.string().trim().min(2).max(2000),
        audience: z.string().trim().max(500).optional(),
        start_date: z.iso.date().optional(),
        end_date: z.iso.date().optional(),
      })
      .refine(value => !value.start_date || !value.end_date || value.end_date >= value.start_date, {
        message: "Campaign end date must not precede start date",
      }),
    organization_id: z.uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
  z.strictObject({
    action: z.literal("ingest_supporting_text"),
    title: z.string().trim().min(2).max(200),
    text: z.string().min(1).max(20000),
    organization_id: z.uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
  z.strictObject({
    action: z.literal("ingest_release"),
    url: z.url().max(2048),
    organization_id: z.uuid().optional(),
    idempotency_key: contextIngestSchema.shape.idempotency_key,
  }),
  z.strictObject({
    action: z.literal("verify_release"),
    request_id: z.uuid(),
    organization_id: z.uuid().optional(),
  }),
  contextIngestSchema.extend({ action: z.literal("ingest") }),
  z.strictObject({
    action: z.literal("read"),
    request_id: z.string().uuid(),
    organization_id: z.string().uuid().optional(),
  }),
  z.strictObject({
    action: z.literal("brief"),
    ...briefFields,
  }),
]);

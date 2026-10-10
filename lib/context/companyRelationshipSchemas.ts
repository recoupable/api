import { z } from "zod";
import { contextIngestSchema } from "./schema";

/** Business vocabulary only: none of these values asserts ownership, a rights share or a mandate. */
export const companyRelationshipKinds = [
  "frontline_roster",
  "catalog_interest",
  "publishing",
  "distribution",
  "management",
  "services",
  "other",
] as const;
export const companyRelationshipStatuses = ["current", "former"] as const;
/**
 * The company holds the relationship toward the counterparty (for example, it has the artist on its
 * frontline roster or distributes for the workspace). Counterparties must already be reachable in the
 * workspace; nothing is created or enrolled.
 */
export const companyRelationshipCounterpartySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("workspace") }),
  z.strictObject({ kind: z.literal("artist_account"), artist_id: z.uuid() }),
  z.strictObject({ kind: z.literal("professional"), professional_id: z.uuid() }),
]);
export const companyRelationshipOperationSchemas = [
  z
    .strictObject({
      action: z.literal("record_company_relationship"),
      organization_id: z.uuid().optional(),
      company_subject_id: z
        .uuid()
        .describe("Saved company subject ID (subjectIds[0]) from ingest_company_name."),
      counterparty: companyRelationshipCounterpartySchema.describe(
        "Who the company holds the relationship toward: the workspace itself, an artist account the workspace can access now, or one of its professionals. Never created, enrolled or granted access.",
      ),
      relationship_kind: z
        .enum(companyRelationshipKinds)
        .describe(
          "What the company holds toward the counterparty, in business vocabulary only; frontline_roster and catalog_interest are separate. Never ownership, rights or a mandate.",
        ),
      status: z
        .enum(companyRelationshipStatuses)
        .describe(
          "former keeps history, such as an artist who left the roster; pair it with supersedes_id when it replaces a current row.",
        ),
      started_on: z.iso.date().optional().describe("Omit when unknown; never inferred."),
      ended_on: z.iso.date().optional().describe("Only with status former. Omit when unknown."),
      note: z.string().trim().max(2000).default(""),
      supersedes_id: z
        .uuid()
        .optional()
        .describe(
          "Earlier relationship row this one replaces, with the same company, counterparty and relationship_kind. The earlier row stays as history and lists superseded_by; each row is superseded at most once.",
        ),
      idempotency_key: contextIngestSchema.shape.idempotency_key,
    })
    .refine(value => value.status === "former" || !value.ended_on, {
      message: "ended_on requires status former",
      path: ["ended_on"],
    })
    .refine(value => !value.started_on || !value.ended_on || value.ended_on >= value.started_on, {
      message: "ended_on must not precede started_on",
      path: ["ended_on"],
    }),
  z.strictObject({
    action: z.literal("list_company_relationships"),
    organization_id: z.uuid().optional(),
    company_subject_id: z.uuid(),
    after_id: z.uuid().optional().describe("next_id from the previous page."),
  }),
] as const;
export type CompanyRelationshipOperation = z.infer<
  (typeof companyRelationshipOperationSchemas)[number]
>;

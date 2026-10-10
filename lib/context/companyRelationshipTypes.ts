import { z } from "zod";
import {
  companyRelationshipCounterpartySchema,
  companyRelationshipKinds,
  companyRelationshipStatuses,
} from "./companyRelationshipSchemas";

const companyRelationshipGapsSchema = z.tuple([
  z.literal("operator_assertion_not_verified"),
  z.literal("no_ownership_rights_or_mandate_implied"),
  z.literal("no_access_granted"),
]);
/** Stored assertion projection, deliberately without ownership, rights or access fields. */
export const companyRelationshipItemSchema = z.strictObject({
  id: z.uuid(),
  company_subject_id: z.uuid(),
  counterparty: companyRelationshipCounterpartySchema,
  relationship_kind: z.enum(companyRelationshipKinds),
  status: z.enum(companyRelationshipStatuses),
  started_on: z.iso.date().nullable(),
  ended_on: z.iso.date().nullable(),
  basis: z.literal("operator_assertion"),
  note: z.string().max(2000),
  asserted_by: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
});
export const companyRelationshipReceiptSchema = z.strictObject({
  contract_version: z.literal("company-relationship-v1"),
  relationship: companyRelationshipItemSchema,
  replayed: z.boolean(),
  gaps: companyRelationshipGapsSchema,
});
export const companyRelationshipPageSchema = z.strictObject({
  contract_version: z.literal("company-relationship-v1"),
  company_subject_id: z.uuid(),
  state: z.enum(["available", "unavailable"]),
  coverage: z.literal("operator_asserted_relationships_only"),
  items: z.array(companyRelationshipItemSchema).max(50),
  next_id: z.uuid().nullable(),
  gaps: companyRelationshipGapsSchema,
});
export type CompanyRelationshipReceipt = z.infer<typeof companyRelationshipReceiptSchema>;
export type CompanyRelationshipPage = z.infer<typeof companyRelationshipPageSchema>;

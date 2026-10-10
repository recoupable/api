import type { CompanyRelationshipOperation } from "./companyRelationshipSchemas";
import {
  companyRelationshipPageSchema,
  companyRelationshipReceiptSchema,
} from "./companyRelationshipTypes";

/** Delegate operator-asserted relationship writes and reads after shared workspace authorization. */
export async function processCompanyRelationshipOperation(
  accountId: string,
  ownerId: string,
  args: CompanyRelationshipOperation,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  if (args.action === "record_company_relationship") {
    const receipt = companyRelationshipReceiptSchema.parse(
      await rpc("record_context_company_relationship", {
        p_actor: accountId,
        p_owner: ownerId,
        p_company_subject: args.company_subject_id,
        p_counterparty: args.counterparty,
        p_kind: args.relationship_kind,
        p_status: args.status,
        p_started_on: args.started_on ?? null,
        p_ended_on: args.ended_on ?? null,
        p_note: args.note,
        p_key: args.idempotency_key,
      }),
    );
    if (receipt.relationship.company_subject_id !== args.company_subject_id)
      throw new Error("Company relationship scope mismatch");
    return receipt;
  }
  const page = companyRelationshipPageSchema.parse(
    await rpc("list_context_company_relationships", {
      p_actor: accountId,
      p_owner: ownerId,
      p_company_subject: args.company_subject_id,
      p_after: args.after_id ?? null,
    }),
  );
  if (
    page.company_subject_id !== args.company_subject_id ||
    page.items.some(item => item.company_subject_id !== args.company_subject_id)
  )
    throw new Error("Company relationship scope mismatch");
  return page;
}

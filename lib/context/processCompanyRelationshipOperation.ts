import type { CompanyRelationshipOperation } from "./companyRelationshipSchemas";
import {
  companyRelationshipPageSchema,
  companyRelationshipReceiptSchema,
} from "./companyRelationshipTypes";

// PostgreSQL echoes canonical lowercase UUIDs; valid input may use uppercase hex.
const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

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
        p_supersedes: args.supersedes_id ?? null,
      }),
    );
    if (!sameId(receipt.relationship.company_subject_id, args.company_subject_id))
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
    !sameId(page.company_subject_id, args.company_subject_id) ||
    page.items.some(item => !sameId(item.company_subject_id, args.company_subject_id))
  )
    throw new Error("Company relationship scope mismatch");
  return page;
}

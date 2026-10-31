import { sameCatalogUuid } from "./sameCatalogUuid";
import type { CatalogCaseOperation } from "./catalogCaseOperationSchemas";
import { catalogCasePageSchema, catalogCaseReceiptSchema } from "./catalogCaseResponseSchemas";

/** Fail closed on malformed, cross-workspace or incorrectly bound storage results. */
export function validateCatalogCaseResult(
  ownerId: string,
  args: CatalogCaseOperation,
  raw: unknown,
) {
  if (args.action === "list_catalog_cases") {
    const page = catalogCasePageSchema.parse(raw);
    // Storage resolves the opaque cursor to (created_at, id) DESC; UUID order alone is invalid.
    if (
      page.cases.length > args.limit ||
      page.cases.some(item => item.case_id.toLowerCase() === args.after_id?.toLowerCase()) ||
      (page.has_more && page.next_id !== page.cases.at(-1)?.case_id)
    )
      throw new Error("Catalog case page scope mismatch");
    return page;
  }
  const receipt = catalogCaseReceiptSchema.parse(raw);
  if (
    !sameCatalogUuid(receipt.case_id, args.case_id) ||
    !sameCatalogUuid(receipt.snapshot.case_id, args.case_id) ||
    !sameCatalogUuid(receipt.snapshot.workspace_id, ownerId) ||
    receipt.snapshot.revision !== receipt.revision
  )
    throw new Error("Catalog case receipt scope mismatch");
  const expected = args.action === "save_catalog_case" ? args.expected_revision + 1 : args.revision;
  if (expected !== undefined && receipt.revision !== expected)
    throw new Error("Catalog case receipt revision mismatch");
  const withheld = Object.values(receipt.snapshot)
    .flatMap(value => (value && typeof value === "object" ? Object.values(value) : []))
    .filter(
      value => value && typeof value === "object" && "withheld" in value && value.withheld === true,
    );
  const actualIds = withheld.map(record => ("id" in record ? record.id : undefined)).sort();
  if (
    (receipt.state === "partial") !== !receipt.snapshot_usable_for_save ||
    (receipt.state === "partial") !== withheld.length > 0 ||
    JSON.stringify(actualIds) !== JSON.stringify([...receipt.withheld_record_ids].sort())
  )
    throw new Error("Catalog case receipt retention mismatch");
  return receipt;
}

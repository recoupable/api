import type { CatalogCaseOperation } from "@/lib/context/catalogCaseOperationSchemas";

/** Catalog artifacts remain standard-only until delegated workspace retention is audited. */
export const catalogCaseToolOperations = {
  save_catalog_case: {
    name: "save_catalog_case",
    description:
      "Save a bounded portable catalog case as a customer assertion. Requires last read revision and an idempotency key. Does not verify rights, authorize provider operations, register music or collect royalties. History is server-maintained; omit local history.",
    readOnly: false,
    delegated: false,
  },
  read_catalog_case: {
    name: "read_catalog_case",
    description:
      "Read the current or specified catalog case revision under current workspace access. Withdrawn Context evidence and dependent records are withheld. A partial snapshot cannot be saved without explicit reassembly.",
    readOnly: true,
    delegated: false,
  },
  list_catalog_cases: {
    name: "list_catalog_cases",
    description:
      "List a bounded page of catalog cases in the selected workspace. Follow next_id as after_id while has_more is true. No artist or request ID is required.",
    readOnly: true,
    delegated: false,
  },
} satisfies Record<
  CatalogCaseOperation["action"],
  { name: string; description: string; readOnly: boolean; delegated: false }
>;

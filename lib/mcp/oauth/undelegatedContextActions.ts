/**
 * Context actions that reference organization professionals stay out of delegated OAuth,
 * matching the professional roster tools, until the organization-grant audit completes.
 */
export const undelegatedContextActions: readonly string[] = [
  "record_company_relationship",
  "list_company_relationships",
];

/** Offer names and IDs only for workspaces visible to the authenticated account. */
export async function listOAuthWorkspaces(accountId: string) {
  const { getAccountOrganizations } = await import(
    "@/lib/supabase/account_organization_ids/getAccountOrganizations"
  );
  const memberships = await getAccountOrganizations({ accountId });
  const organizations = new Map(
    memberships
      .filter(row => row.organization)
      .map(row => [row.organization!.id.toLowerCase(), row.organization!]),
  );
  return [
    { kind: "personal" as const, organizationId: null, name: "Personal workspace" },
    ...[...organizations].map(([id, organization]) => ({
      kind: "organization" as const,
      organizationId: id,
      name: organization.name || "Organization workspace",
    })),
  ];
}

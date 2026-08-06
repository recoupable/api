import { selectCatalogOwnerLinks } from "@/lib/supabase/account_catalogs/selectCatalogOwnerLinks";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { selectAccountInfos } from "@/lib/supabase/account_info/selectAccountInfos";

export type CatalogOwner = {
  id: string;
  name: string | null;
  image: string | null;
  is_organization: boolean;
};

/**
 * The owner to show for each catalog in a list response.
 *
 * Ownership lives on `account_catalogs`, not on the catalog, and a catalog can
 * carry several links — one for the account and one for an organization it
 * also belongs to. When both exist the **organization wins**: a member seeing
 * their own avatar on a catalog the whole org can edit is the misleading half
 * of the truth (chat#1943).
 *
 * `is_organization` is derived, not stored: an owner is an organization when it
 * is one of the caller's organizations, the same set `getCatalogOwnerIds`
 * resolves for visibility (chat#1938).
 *
 * Three batched reads regardless of how many catalogs are passed.
 *
 * @param params.catalogIds - Catalogs to resolve owners for
 * @param params.organizationIds - The caller's organization ids
 * @returns catalog id → owner
 */
export async function resolveCatalogOwners({
  catalogIds,
  organizationIds,
}: {
  catalogIds: string[];
  organizationIds: string[];
}): Promise<Map<string, CatalogOwner>> {
  const owners = new Map<string, CatalogOwner>();
  if (!catalogIds.length) return owners;

  const links = await selectCatalogOwnerLinks(catalogIds);
  const organizations = new Set(organizationIds);

  const ownerIdByCatalog = new Map<string, string>();
  for (const link of links) {
    const current = ownerIdByCatalog.get(link.catalog);
    if (!current || (organizations.has(link.account) && !organizations.has(current))) {
      ownerIdByCatalog.set(link.catalog, link.account);
    }
  }

  const ownerIds = [...new Set(ownerIdByCatalog.values())];
  const [accounts, infos] = await Promise.all([
    selectAccounts(ownerIds),
    selectAccountInfos(ownerIds),
  ]);
  const nameById = new Map(accounts.map(account => [account.id, account.name ?? null]));
  const imageById = new Map(infos.map(info => [info.account_id, info.image ?? null]));

  for (const [catalogId, ownerId] of ownerIdByCatalog) {
    owners.set(catalogId, {
      id: ownerId,
      name: nameById.get(ownerId) ?? null,
      image: imageById.get(ownerId) ?? null,
      is_organization: organizations.has(ownerId),
    });
  }

  return owners;
}

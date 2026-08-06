import { selectAccountCatalogs } from "@/lib/supabase/account_catalogs/selectAccountCatalogs";
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
 * carry several links — one for the account and one for an organization it also
 * belongs to. When both exist the **organization wins**: a member seeing their
 * own avatar on a catalog the whole org can edit is the misleading half of the
 * truth (chat#1943).
 *
 * Only owners the caller reads through are eligible, because
 * `selectAccountCatalogs` is asked for exactly those. A catalog can be linked to
 * unrelated accounts — one on prod carries four links — and naming a stranger
 * would be wrong attribution *and* a disclosure of their name and avatar.
 *
 * `is_organization` is derived, not stored: an owner is an organization when it
 * is one of the caller's organizations, the same set `getCatalogOwnerIds`
 * resolves for visibility (chat#1938).
 *
 * Three batched reads regardless of how many catalogs are passed.
 *
 * @param params.catalogIds - Catalogs to resolve owners for
 * @param params.ownerIds - The owner set the caller reads through: their account plus its organizations
 * @param params.organizationIds - The caller's organization ids, a subset of ownerIds
 * @returns catalog id → owner
 */
export async function resolveCatalogOwners({
  catalogIds,
  ownerIds,
  organizationIds,
}: {
  catalogIds: string[];
  ownerIds: string[];
  organizationIds: string[];
}): Promise<Map<string, CatalogOwner>> {
  const owners = new Map<string, CatalogOwner>();
  if (!catalogIds.length) return owners;

  const catalogs = await selectAccountCatalogs(ownerIds, { catalogIds });
  const organizations = new Set(organizationIds);

  const ownerIdByCatalog = new Map<string, string>();
  for (const catalog of catalogs) {
    const organization = catalog.owners.find(owner => organizations.has(owner));
    const ownerId = organization ?? catalog.owners[0];
    if (ownerId) ownerIdByCatalog.set(catalog.id, ownerId);
  }

  const resolvedOwnerIds = [...new Set(ownerIdByCatalog.values())];
  const [accounts, infos] = await Promise.all([
    selectAccounts(resolvedOwnerIds),
    selectAccountInfos(resolvedOwnerIds),
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

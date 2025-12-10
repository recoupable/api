import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { getUserPinnedArtistIds } from "@/lib/supabase/account_artist_ids/getUserPinnedArtistIds";
import { getAccountWorkspaceIds } from "@/lib/supabase/account_workspace_ids/getAccountWorkspaceIds";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { getArtistsByOrganization } from "@/lib/supabase/artist_organization_ids/getArtistsByOrganization";
import { FormattedArtist } from "@/lib/artists/getFormattedArtist";

export interface GetArtistsOptions {
  accountId: string;
  orgId?: string | null; // Filter by specific org, null = personal only, undefined = all
}

/**
 * Get artists for an account with organization filtering.
 *
 * Filtering modes:
 * - orgId = specific UUID: Return only artists from that organization
 * - orgId = null: Return only personal artists (not in any org)
 * - orgId = undefined: Return all artists (personal + all orgs)
 *
 * @param options - Account ID and optional org filter
 * @returns Array of formatted artist objects
 */
export async function getArtists(options: GetArtistsOptions): Promise<FormattedArtist[]> {
  const { accountId, orgId } = options;

  // If filtering by a specific org, return org's artists with account's pinned status
  if (orgId) {
    const [orgArtists, pinnedIds] = await Promise.all([
      getArtistsByOrganization([orgId]),
      getUserPinnedArtistIds(accountId),
    ]);

    // Merge account's pinned preferences with org artists
    return orgArtists.map(artist => ({
      ...artist,
      pinned: pinnedIds.has(artist.account_id),
    }));
  }

  // If orgId is explicitly null, return only personal artists + workspaces (excluding org artists)
  if (orgId === null) {
    const [accountArtists, accountWorkspaces, accountOrgs] = await Promise.all([
      getAccountArtistIds({ accountIds: [accountId] }),
      getAccountWorkspaceIds(accountId),
      getAccountOrganizations(accountId),
    ]);

    // Get all org artist IDs to exclude from personal view
    const orgIds = accountOrgs
      .map(org => org.organization_id)
      .filter((id): id is string => id !== null);
    const orgArtists = orgIds.length > 0 ? await getArtistsByOrganization(orgIds) : [];
    const orgArtistIds = new Set(orgArtists.map(a => a.account_id));

    // Return only artists + workspaces NOT in any org
    const personalEntities = [...accountArtists, ...accountWorkspaces];
    return personalEntities.filter(entity => !orgArtistIds.has(entity.account_id));
  }

  // Default: return all artists + workspaces (personal + all orgs)
  const [accountArtists, accountWorkspaces, accountOrgs] = await Promise.all([
    getAccountArtistIds({ accountIds: [accountId] }),
    getAccountWorkspaceIds(accountId),
    getAccountOrganizations(accountId),
  ]);

  // Get artists from all orgs the account belongs to
  const orgIds = accountOrgs
    .map(org => org.organization_id)
    .filter((id): id is string => id !== null);
  const orgArtists = orgIds.length > 0 ? await getArtistsByOrganization(orgIds) : [];

  // Combine all: personal artists + workspaces + org artists
  // Deduplicate by account_id
  const uniqueByAccountId = new Map<string, FormattedArtist>();
  [...accountArtists, ...accountWorkspaces, ...orgArtists].forEach(entity => {
    if (entity?.account_id && !uniqueByAccountId.has(entity.account_id)) {
      uniqueByAccountId.set(entity.account_id, entity);
    }
  });

  return Array.from(uniqueByAccountId.values());
}


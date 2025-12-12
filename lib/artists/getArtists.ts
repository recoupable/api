import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { getAccountPinnedArtistIds } from "@/lib/supabase/account_artist_ids/getAccountPinnedArtistIds";
import { getAccountWorkspaceIds } from "@/lib/supabase/account_workspace_ids/getAccountWorkspaceIds";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { getArtistsByOrganization } from "@/lib/supabase/artist_organization_ids/getArtistsByOrganization";
import { getFormattedArtist, FormattedArtist } from "@/lib/artists/getFormattedArtist";

export interface GetArtistsOptions {
  accountId: string;
  orgId?: string | null; // Filter by specific org, null = personal only, undefined = all
}

/**
 * Get artists for an account with organization filtering.
 * Handles all formatting - Supabase libs return raw data.
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
    const [orgArtistsRaw, pinnedIds] = await Promise.all([
      getArtistsByOrganization([orgId]),
      getAccountPinnedArtistIds(accountId),
    ]);

    // Format and deduplicate by artist_id, merge account's pinned preferences
    const artistMap = new Map<string, FormattedArtist>();
    orgArtistsRaw.forEach(row => {
      if (row.artist_id && !artistMap.has(row.artist_id)) {
        const formatted = getFormattedArtist(row);
        if (formatted?.account_id) {
          artistMap.set(row.artist_id, {
            ...formatted,
            pinned: pinnedIds.has(formatted.account_id),
          });
        }
      }
    });

    return Array.from(artistMap.values());
  }

  // If orgId is explicitly null, return only personal artists + workspaces (excluding org artists)
  if (orgId === null) {
    const [accountArtistsRaw, accountWorkspacesRaw, accountOrgs] = await Promise.all([
      getAccountArtistIds({ accountIds: [accountId] }),
      getAccountWorkspaceIds(accountId),
      getAccountOrganizations(accountId),
    ]);

    // Format artists
    const accountArtists = accountArtistsRaw.map(row => getFormattedArtist(row));

    // Format workspaces (map workspace_info to artist_info, add isWorkspace flag)
    const accountWorkspaces = accountWorkspacesRaw.map(row => ({
      ...getFormattedArtist({ ...row, artist_info: row.workspace_info }),
      isWorkspace: true,
    }));

    // Get all org artist IDs to exclude from personal view
    const orgIds = accountOrgs
      .map(org => org.organization_id)
      .filter((id): id is string => id !== null);
    const orgArtistsRaw = orgIds.length > 0 ? await getArtistsByOrganization(orgIds) : [];
    const orgArtistIds = new Set(
      orgArtistsRaw
        .map(row => getFormattedArtist(row).account_id)
        .filter(Boolean),
    );

    // Return only artists + workspaces NOT in any org
    const personalEntities = [...accountArtists, ...accountWorkspaces];
    return personalEntities.filter(entity => !orgArtistIds.has(entity.account_id));
  }

  // Default: return all artists + workspaces (personal + all orgs)
  const [accountArtistsRaw, accountWorkspacesRaw, accountOrgs] = await Promise.all([
    getAccountArtistIds({ accountIds: [accountId] }),
    getAccountWorkspaceIds(accountId),
    getAccountOrganizations(accountId),
  ]);

  // Format artists
  const accountArtists = accountArtistsRaw.map(row => getFormattedArtist(row));

  // Format workspaces (map workspace_info to artist_info, add isWorkspace flag)
  const accountWorkspaces = accountWorkspacesRaw.map(row => ({
    ...getFormattedArtist({ ...row, artist_info: row.workspace_info }),
    isWorkspace: true,
  }));

  // Get artists from all orgs the account belongs to
  const orgIds = accountOrgs
    .map(org => org.organization_id)
    .filter((id): id is string => id !== null);
  const orgArtistsRaw = orgIds.length > 0 ? await getArtistsByOrganization(orgIds) : [];

  // Format org artists with deduplication
  const orgArtists: FormattedArtist[] = [];
  const seenOrgArtistIds = new Set<string>();
  orgArtistsRaw.forEach(row => {
    if (row.artist_id && !seenOrgArtistIds.has(row.artist_id)) {
      const formatted = getFormattedArtist(row);
      if (formatted?.account_id) {
        seenOrgArtistIds.add(row.artist_id);
        orgArtists.push(formatted);
      }
    }
  });

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


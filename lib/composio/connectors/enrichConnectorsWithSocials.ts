import type { ConnectorInfo } from "./getConnectors";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import type { Tables } from "@/types/database.types";

type SocialRow = Tables<"socials">;

/**
 * Connector slug → expected social profile hostname.
 */
const CONNECTOR_SOCIAL_HOSTNAMES: Record<string, string> = {
  instagram: "instagram.com",
  tiktok: "tiktok.com",
};

/**
 * Match a social profile_url hostname to a connector slug.
 */
function matchesPlatform(
  profileUrl: string,
  expectedHostname: string,
): boolean {
  try {
    const hostname = new URL(profileUrl).hostname.toLowerCase();
    return (
      hostname === expectedHostname || hostname.endsWith(`.${expectedHostname}`)
    );
  } catch {
    return false;
  }
}

/**
 * Enrich connectors with social profile data (avatar, username) from Supabase.
 *
 * For each connected connector that has a social platform mapping,
 * looks up the artist's social profiles and adds avatar/username.
 *
 * @param connectors - The connectors from Composio
 * @param accountId - The artist account ID to look up socials for
 * @returns Enriched connectors with optional avatar and username
 */
export async function enrichConnectorsWithSocials(
  connectors: ConnectorInfo[],
  accountId: string,
): Promise<ConnectorInfo[]> {
  const accountSocials = await selectAccountSocials(accountId);
  const socials: SocialRow[] = (accountSocials || [])
    .map((item) => (item as any).social as SocialRow | null)
    .filter((s): s is SocialRow => s !== null);

  return connectors.map((connector) => {
    if (!connector.isConnected) return connector;

    const expectedHostname = CONNECTOR_SOCIAL_HOSTNAMES[connector.slug];
    if (!expectedHostname) return connector;

    const social = socials.find((s) =>
      matchesPlatform(s.profile_url, expectedHostname),
    );

    if (!social) return connector;

    return {
      ...connector,
      avatar: social.avatar,
      username: social.username,
    };
  });
}

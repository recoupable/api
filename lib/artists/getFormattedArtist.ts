import { getSocialPlatformByLink } from "./getSocialPlatformByLink";

export interface FormattedArtist {
  account_id: string;
  name: string | null;
  image?: string | null;
  instruction?: string | null;
  knowledges?: unknown;
  label?: string | null;
  account_socials: Array<{
    id: string;
    profile_url: string;
    username: string;
    link: string;
    type: string;
    [key: string]: unknown;
  }>;
  pinned: boolean;
  isWorkspace?: boolean;
}

/**
 * Formats a raw artist row from the database into a consistent shape.
 *
 * @param row - The raw row from account_artist_ids or artist_organization_ids query
 * @returns Formatted artist object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFormattedArtist(row: any): FormattedArtist {
  const artist = row.artist_info || row;
  const account_id = artist.id;
  const account_info = artist.account_info?.[0];
  const info = account_info || {
    image: "",
    knowledges: [],
    label: "",
    instruction: "",
  };

  const account_socials = (artist.account_socials || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (social: any) => ({
      ...social.social,
      link: social.social?.profile_url || "",
      type: getSocialPlatformByLink(social.social?.profile_url || ""),
    }),
  );

  return {
    name: artist.name,
    ...info,
    account_id,
    account_socials,
    pinned: row.pinned || false,
  };
}


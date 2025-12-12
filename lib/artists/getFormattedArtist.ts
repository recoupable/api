import { getSocialPlatformByLink } from "./getSocialPlatformByLink";
import type { Database } from "@/types/database.types";

// Use Supabase schema types directly (DRY principle)
type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type AccountInfoRow = Database["public"]["Tables"]["account_info"]["Row"];
type AccountSocialsRow = Database["public"]["Tables"]["account_socials"]["Row"];
type SocialsRow = Database["public"]["Tables"]["socials"]["Row"];

// Input type: Supabase join query result shape from account_artist_ids or artist_organization_ids
type AccountSocialWithSocial = AccountSocialsRow & {
  social: SocialsRow | null;
};

type ArtistInfo = AccountRow & {
  account_socials: AccountSocialWithSocial[];
  account_info: AccountInfoRow[];
};

// Row from account_artist_ids or artist_organization_ids with joined artist_info
export interface ArtistQueryRow {
  artist_info?: ArtistInfo | null;
  pinned?: boolean;
  // Allow direct artist fields when row IS the artist (no artist_info wrapper)
  id?: string;
  name?: string | null;
  account_socials?: AccountSocialWithSocial[];
  account_info?: AccountInfoRow[];
}

// FormattedArtist composes fields from multiple tables + computed fields
export interface FormattedArtist
  extends Pick<AccountInfoRow, "image" | "instruction" | "knowledges" | "label"> {
  account_id: AccountRow["id"];
  name: AccountRow["name"];
  account_socials: Array<
    Pick<SocialsRow, "id" | "profile_url" | "username"> & {
      link: string;
      type: string;
    }
  >;
  pinned: boolean;
  isWorkspace?: boolean;
}

/**
 * Formats a raw artist row from the database into a consistent shape.
 *
 * @param row - The raw row from account_artist_ids or artist_organization_ids query
 * @returns Formatted artist object
 */
export function getFormattedArtist(row: ArtistQueryRow): FormattedArtist {
  const artist = row.artist_info || row;
  const account_id = artist.id || "";
  const account_info = artist.account_info?.[0];
  const info = account_info || {
    image: "",
    knowledges: [],
    label: "",
    instruction: "",
  };

  const account_socials = (artist.account_socials || []).map(
    (social: AccountSocialWithSocial) => ({
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


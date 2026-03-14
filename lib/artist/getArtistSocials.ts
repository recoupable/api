import { selectAccountSocialsCount } from "@/lib/supabase/account_socials/selectAccountSocialsCount";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import {
  flattenAccountSocials,
  type AccountSocialResponse,
} from "@/lib/account/flattenAccountSocials";
import type { ArtistSocialsQuery } from "@/lib/artist/validateArtistSocialsQuery";

export interface GetArtistSocialsResponse {
  status: "success" | "error";
  message?: string;
  socials: AccountSocialResponse[];
  pagination: {
    total_count: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

/**
 * Retrieves all social profiles associated with an artist account
 *
 * @param params - Parameters including artist_account_id and pagination (page and limit have defaults)
 * @returns List of social profiles with pagination metadata
 */
export const getArtistSocials = async (
  params: ArtistSocialsQuery,
): Promise<GetArtistSocialsResponse> => {
  try {
    const { artist_account_id, page, limit } = params;

    // Ensure limit is within reasonable bounds
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (page - 1) * validatedLimit;

    // Get total count for pagination
    const count = await selectAccountSocialsCount(artist_account_id);

    // If no results, return empty array with pagination
    if (count === 0) {
      return {
        status: "success",
        socials: [],
        pagination: {
          total_count: 0,
          page,
          limit: validatedLimit,
          total_pages: 0,
        },
      };
    }

    // Fetch social profiles with pagination
    const accountSocials = await selectAccountSocials(artist_account_id, offset, validatedLimit);

    // Transform data to match the expected response format
    const socials = flattenAccountSocials(accountSocials);

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / validatedLimit);

    return {
      status: "success",
      socials,
      pagination: {
        total_count: count,
        page,
        limit: validatedLimit,
        total_pages: totalPages,
      },
    };
  } catch (error) {
    console.error("[ERROR] getArtistSocials error:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "An unknown error occurred",
      socials: [],
      pagination: {
        total_count: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
      },
    };
  }
};

import type { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { isArtistAccount } from "@/lib/artists/isArtistAccount";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

/**
 * Checks the two accounts on a post (recoupable/app#2248): the resolved
 * `account_id` is charged, so it must not be an artist; the artist whose
 * connection posts must be one the account can access.
 *
 * @param params - The resolved account and the optional artist.
 * @returns A 400 or 403 the caller returns as-is, or null when both are valid.
 */
export async function validatePostAccounts(params: {
  accountId: string;
  artist_account_id?: string;
}): Promise<NextResponse | null> {
  if (await isArtistAccount(params.accountId)) {
    return errorResponse("account_id is an artist; pass it as artist_account_id", 400, {
      missing_fields: ["account_id"],
    });
  }

  if (
    params.artist_account_id &&
    !(await checkAccountArtistAccess(params.accountId, params.artist_account_id))
  ) {
    return errorResponse("Access denied to the specified artist_account_id", 403);
  }

  return null;
}

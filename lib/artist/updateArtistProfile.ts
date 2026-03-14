import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { updateAccount } from "@/lib/supabase/accounts/updateAccount";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { updateAccountInfo } from "@/lib/supabase/account_info/updateAccountInfo";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import type { Tables } from "@/types/database.types";

export type Knowledge = {
  url: string;
  name: string;
  type: string;
};

export type ArtistProfile = Tables<"accounts"> & Tables<"account_info">;

/**
 * Updates an artist profile (account and account_info).
 * All fields are optional except artistId.
 *
 * @param artistId - The artist account ID
 * @param image - Optional profile image URL
 * @param name - Optional display name
 * @param instruction - Optional custom instructions
 * @param label - Optional label/role
 * @param knowledges - Optional array of knowledge objects
 * @returns The updated artist profile
 */
export async function updateArtistProfile(
  artistId: string,
  image: string,
  name: string,
  instruction: string,
  label: string,
  knowledges: Knowledge[] | null,
): Promise<ArtistProfile> {
  // Fetch current account
  const currentAccounts = await selectAccounts(artistId);
  const currentAccount = currentAccounts[0];
  if (!currentAccount) {
    throw new Error("Artist does not exist");
  }

  // Update account name if provided
  if (name) {
    const accountUpdate = { name };
    const updatedAccount = await updateAccount(artistId, accountUpdate);
    if (!updatedAccount) {
      throw new Error("Failed to update account");
    }
  }

  // Get or create account_info
  const accountInfo = await selectAccountInfo(artistId);

  if (accountInfo) {
    // Update existing account_info
    const infoUpdate: Partial<typeof accountInfo> = {};
    if (image) infoUpdate.image = image;
    if (instruction) infoUpdate.instruction = instruction;

    if (knowledges !== null && knowledges !== undefined) {
      // Deduplicate knowledges by URL
      const uniqueMap = new Map(knowledges.map(k => [k.url, k]));
      infoUpdate.knowledges = Array.from(uniqueMap.values());
    }

    if (label !== undefined) {
      infoUpdate.label = label === "" ? null : label;
    }

    await updateAccountInfo(artistId, infoUpdate);
  } else {
    // Create new account_info
    await insertAccountInfo({
      image: image || null,
      instruction: instruction || null,
      knowledges: knowledges || null,
      label: label === "" ? null : label || null,
      account_id: artistId,
    });
  }

  // Fetch and return the latest account and account_info
  const [updatedAccounts, updatedAccountInfo] = await Promise.all([
    selectAccounts(artistId),
    selectAccountInfo(artistId),
  ]);

  const account = updatedAccounts[0];
  if (!account || !updatedAccountInfo) {
    throw new Error("Failed to fetch updated artist profile");
  }

  return {
    ...updatedAccountInfo,
    ...account,
  };
}

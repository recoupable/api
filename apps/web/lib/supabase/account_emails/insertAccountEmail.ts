import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Inserts a new account_emails record linking an email to an account.
 *
 * @param accountId - The account ID to link the email to
 * @param email - The email address to insert
 * @returns The inserted account_emails record, or null if failed
 */
export async function insertAccountEmail(
  accountId: string,
  email: string,
): Promise<Tables<"account_emails"> | null> {
  const { data, error } = await supabase
    .from("account_emails")
    .insert({
      account_id: accountId,
      email,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[ERROR] insertAccountEmail:", error);
    return null;
  }

  return data || null;
}

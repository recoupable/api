import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Selects an account_emails record by email address.
 *
 * @param email - The email address to look up
 * @returns The account_emails record if found, null otherwise
 */
export async function selectAccountByEmail(
  email: string,
): Promise<Tables<"account_emails"> | null> {
  const { data, error } = await supabase
    .from("account_emails")
    .select("*")
    .eq("email", email)
    .single();

  if (error) {
    return null;
  }

  return data || null;
}

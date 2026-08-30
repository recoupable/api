import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

const escapeLike = (value: string) => value.replace(/[%_\\]/g, ch => `\\${ch}`);

/**
 * Case-insensitive `account_emails` lookup for addresses that arrive from
 * outside (Stripe keeps the casing the buyer typed). `%` and `_` are escaped
 * so the match stays exact apart from case. Returns the first match, null on
 * error or no match.
 */
export async function selectAccountEmail(email: string): Promise<Tables<"account_emails"> | null> {
  const { data, error } = await supabase
    .from("account_emails")
    .select("*")
    .ilike("email", escapeLike(email))
    .limit(1);

  if (error) {
    console.error("Error fetching account_emails by email:", error);
    return null;
  }
  return data?.[0] ?? null;
}

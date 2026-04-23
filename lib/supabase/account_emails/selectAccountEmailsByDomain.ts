import supabase from "@/lib/supabase/serverClient";

/**
 * Select account_emails whose address contains `@<domain>` anywhere in the
 * local-or-host part — matches the legacy `ilike("email", "%@<domain>%")`
 * quirk (it will match `user+tag@<domain>.anything`), preserved intentionally
 * for wire parity with the Express service.
 */
export async function selectAccountEmailsByDomain(domain: string) {
  const { data, error } = await supabase
    .from("account_emails")
    .select("*")
    .ilike("email", `%@${domain}%`);

  if (error) {
    console.error("Error fetching account_emails by domain:", error);
    return [];
  }

  return data ?? [];
}

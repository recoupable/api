import serverClient from "../serverClient";

/**
 * Fetches account emails for the given account IDs.
 *
 * @param accountIds - Single ID or array of account IDs
 * @returns Array of account email records
 */
export async function getAccountEmails(
  accountIds: string | string[],
) {
  const ids = Array.isArray(accountIds) ? accountIds : [accountIds];
  if (ids.length === 0) return [];

  const { data, error } = await serverClient
    .from("account_emails")
    .select("*")
    .in("account_id", ids);

  if (error) {
    console.error("Error fetching account emails:", error);
    throw error;
  }

  return data || [];
}

export default getAccountEmails;

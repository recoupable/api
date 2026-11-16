/**
 * The account's most recently updated non-empty email, or null — the one
 * address an account-level notice goes to.
 *
 * @param rows - The account's `account_emails` rows.
 * @returns The chosen address, or null when the account has none.
 */
export function pickAccountRecipient(
  rows: { email: string | null; updated_at?: string }[],
): string | null {
  const withEmail = rows.filter(r => r.email);
  withEmail.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  return withEmail[0]?.email ?? null;
}

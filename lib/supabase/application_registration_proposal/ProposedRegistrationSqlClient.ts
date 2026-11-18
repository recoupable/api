/** Trusted injected server client only; no connection or ambient configuration.
 * Requires an idle autocommit session already holding the intended privileges.
 * The helpers do not establish or verify session state. Proposal-only, unwired.
 */
export interface ProposedRegistrationSqlClient {
  query(text: string, values: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

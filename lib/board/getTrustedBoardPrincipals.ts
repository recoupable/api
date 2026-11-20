/**
 * Reads the board principals whose tasks may start Claude, from the
 * comma-separated BOARD_TRUSTED_PRINCIPALS variable. An unset or empty
 * variable trusts nobody, so no task starts an agent.
 *
 * @returns Principal IDs, as `vb actors` lists them.
 */
export function getTrustedBoardPrincipals(): string[] {
  return (process.env.BOARD_TRUSTED_PRINCIPALS ?? "")
    .split(",")
    .map(principal => principal.trim())
    .filter(Boolean);
}

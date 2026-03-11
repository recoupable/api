import type { Tables } from "@/types/database.types";
import { selectAccountSandboxes } from "./selectAccountSandboxes";

/**
 * Fetches all account sandbox records across every account.
 * Intended for admin-only use where no account/org filter is needed.
 *
 * @returns Array of all account_sandboxes rows ordered by created_at desc
 */
export async function selectAllAccountSandboxStats(): Promise<
  Tables<"account_sandboxes">[]
> {
  return selectAccountSandboxes({});
}

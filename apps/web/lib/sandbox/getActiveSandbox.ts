import { Sandbox } from "@vercel/sandbox";
import { selectAccountSandboxes } from "@/lib/supabase/account_sandboxes/selectAccountSandboxes";

/**
 * Finds the most recent sandbox for an account and returns it if still running.
 *
 * @param accountId - The account ID to find an active sandbox for
 * @returns The running Sandbox instance, or null if none found
 */
export async function getActiveSandbox(accountId: string): Promise<Sandbox | null> {
  const sandboxes = await selectAccountSandboxes({
    accountIds: [accountId],
  });

  if (sandboxes.length === 0) {
    return null;
  }

  const mostRecent = sandboxes[0];

  try {
    const sandbox = await Sandbox.get({ sandboxId: mostRecent.sandbox_id });

    if (sandbox.status === "running") {
      return sandbox;
    }

    return null;
  } catch {
    return null;
  }
}

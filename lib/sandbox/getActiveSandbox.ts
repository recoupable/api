import { VercelSandbox } from "@/lib/sandbox/vercel";
import { selectAccountSandboxes } from "@/lib/supabase/account_sandboxes/selectAccountSandboxes";

/**
 * Finds the most recent sandbox for an account and returns it if still running.
 * Reconnects via the open-agents sandbox abstraction.
 *
 * @param accountId - The account ID to find an active sandbox for
 * @returns The running VercelSandbox instance, or null if none found
 */
export async function getActiveSandbox(accountId: string): Promise<VercelSandbox | null> {
  const sandboxes = await selectAccountSandboxes({
    accountIds: [accountId],
  });

  if (sandboxes.length === 0) {
    return null;
  }

  const mostRecent = sandboxes[0];

  try {
    const sandbox = await VercelSandbox.connect(mostRecent.sandbox_id, {});

    if (sandbox.sdkStatus === "running") {
      return sandbox;
    }

    return null;
  } catch {
    return null;
  }
}

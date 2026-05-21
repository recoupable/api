import { isAgentContext } from "@/lib/agent/tools/utils";

/**
 * Build a per-invocation env override carrying Recoupable sandbox context —
 * access token and (when the sandbox was opened against an org repo) the
 * org UUID — so outbound shell commands (curl, scripts, the `recoup-api`
 * skill) can authenticate and scope requests without any credential or
 * org state persisting on the sandbox.
 *
 * Returns `undefined` when nothing is available to inject so callers can
 * cleanly spread a conditional `...(env ? { env } : {})` into exec opts.
 *
 * @param experimental_context - The opaque context object passed by AI SDK to tool execute.
 */
export function buildRecoupExecEnv(
  experimental_context: unknown,
): Record<string, string> | undefined {
  const context = isAgentContext(experimental_context) ? experimental_context : undefined;
  if (!context) return undefined;

  const env: Record<string, string> = {};
  if (context.recoupAccessToken) {
    env.RECOUP_ACCESS_TOKEN = context.recoupAccessToken;
  }
  if (context.recoupOrgId) {
    env.RECOUP_ORG_ID = context.recoupOrgId;
  }

  return Object.keys(env).length > 0 ? env : undefined;
}

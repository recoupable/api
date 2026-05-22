import { isAgentContext } from "@/lib/agent/tools/isAgentContext";

/**
 * Build a per-invocation env override carrying Recoupable sandbox context
 * so outbound shell commands (curl, scripts, the `recoup-api` skill) can
 * scope requests correctly without any state persisting on the sandbox.
 *
 * Injects:
 *   - `RECOUP_ORG_ID` — public organization UUID. Always safe.
 *   - `RECOUP_ACCESS_TOKEN` — short-lived Privy JWT, when the handler
 *     plumbed one through `AgentContext.recoupAccessToken`. Used by the
 *     `recoup-api` skill's curl examples to authenticate as the user.
 *     Long-lived api keys are deliberately NOT forwarded — only the
 *     short-lived bearer token is, and only when the caller used
 *     bearer auth (the handler enforces that gating).
 *
 * Returns `undefined` when nothing is available to inject so callers can
 * cleanly spread a conditional `...(env ? { env } : {})` into exec opts.
 *
 * @param experimental_context - The opaque context object passed by AI SDK to tool execute.
 */
export function buildRecoupExecEnv(
  experimental_context: unknown,
): Record<string, string> | undefined {
  if (!isAgentContext(experimental_context)) return undefined;

  const env: Record<string, string> = {};
  if (experimental_context.recoupOrgId) {
    env.RECOUP_ORG_ID = experimental_context.recoupOrgId;
  }
  if (experimental_context.recoupAccessToken) {
    env.RECOUP_ACCESS_TOKEN = experimental_context.recoupAccessToken;
  }

  return Object.keys(env).length > 0 ? env : undefined;
}

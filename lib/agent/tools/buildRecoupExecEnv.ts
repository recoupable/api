import { isAgentContext } from "@/lib/agent/tools/isAgentContext";

/**
 * Build a per-invocation env override carrying Recoupable sandbox context
 * so outbound shell commands (curl, scripts, the `recoup-api` skill) can
 * scope requests correctly without any state persisting on the sandbox.
 *
 * Injects:
 *   - `RECOUP_ORG_ID` — public organization UUID. Always safe.
 *   - `RECOUP_ACCESS_TOKEN` — the short-lived credential from
 *     `AgentContext.recoupAccessToken`, which the `recoup-api` skill sends as
 *     `Authorization: Bearer`. This may be a Privy JWT (interactive path) or an
 *     ephemeral `recoup_sk_` API key (headless `/api/chat/runs`) — the server
 *     parses the format and authenticates either over Bearer, so there's no
 *     client-side routing here (recoupable/chat#1815). Long-lived api keys are
 *     deliberately NOT forwarded — only the short-lived credential the handler
 *     plumbed through.
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

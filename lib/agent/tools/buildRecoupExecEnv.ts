import { isAgentContext } from "@/lib/agent/tools/isAgentContext";

/**
 * Build a per-invocation env override carrying Recoupable sandbox context
 * so outbound shell commands (curl, scripts, the `recoup-api` skill) can
 * scope requests correctly without any state persisting on the sandbox.
 *
 * Currently injects only `RECOUP_ORG_ID` — a public identifier. Auth-token
 * injection is deliberately NOT included here; a long-lived api key in the
 * sandbox env would be readable by any model-issued bash command. Proper
 * short-lived token minting will land alongside the `skill` tool port
 * (when there's an actual consumer for it).
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

  return Object.keys(env).length > 0 ? env : undefined;
}

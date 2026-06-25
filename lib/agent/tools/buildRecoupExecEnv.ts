import { isAgentContext } from "@/lib/agent/tools/isAgentContext";

/**
 * Build a per-invocation env override carrying Recoupable sandbox context
 * so outbound shell commands (curl, scripts, the `recoup-api` skill) can
 * scope requests correctly without any state persisting on the sandbox.
 *
 * Injects:
 *   - `RECOUP_ORG_ID` — public organization UUID. Always safe.
 *   - A short-lived credential from `AgentContext.recoupAccessToken`, routed by
 *     type so the `recoup-api` skill sends the right auth header:
 *       • an ephemeral `recoup_sk_` API key (headless `/api/chat/runs`) →
 *         `RECOUP_API_KEY`, which the skill sends as `x-api-key`. REST
 *         endpoints reject an API key over `Authorization: Bearer` (the JWT
 *         path → 401), so it must NOT go in `RECOUP_ACCESS_TOKEN`
 *         (recoupable/chat#1815).
 *       • anything else (a short-lived Privy JWT from the interactive path) →
 *         `RECOUP_ACCESS_TOKEN`, which the skill sends as `Authorization:
 *         Bearer`.
 *     Long-lived api keys are deliberately NOT forwarded — only the
 *     short-lived credential the handler plumbed through.
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
  const token = experimental_context.recoupAccessToken;
  if (token) {
    if (token.startsWith("recoup_sk_")) {
      env.RECOUP_API_KEY = token;
    } else {
      env.RECOUP_ACCESS_TOKEN = token;
    }
  }

  return Object.keys(env).length > 0 ? env : undefined;
}

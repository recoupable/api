import { AI_GATEWAY_HOST } from "@/lib/board/aiGatewayHost";

/** Placeholder the sandbox proxy replaces with the real gateway credential. */
const BROKERED_TOKEN_PLACEHOLDER = "brokered-by-sandbox-proxy";

/**
 * Builds the sandbox environment for Claude Code: the board's placeholder env
 * plus AI Gateway settings. No real credential appears here.
 *
 * @param boardEnv - The env returned by the board's `sandboxPolicy()`.
 * @returns The sandbox environment.
 */
export function buildClaudeSandboxEnv(boardEnv: Record<string, string>): Record<string, string> {
  return {
    ...boardEnv,
    ANTHROPIC_BASE_URL: `https://${AI_GATEWAY_HOST}`,
    ANTHROPIC_AUTH_TOKEN: BROKERED_TOKEN_PLACEHOLDER,
    ANTHROPIC_API_KEY: "",
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  };
}

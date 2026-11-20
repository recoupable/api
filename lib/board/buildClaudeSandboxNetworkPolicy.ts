import type { NetworkPolicyRule } from "vercel-sandbox-3";

import { AI_GATEWAY_HOST } from "@/lib/board/aiGatewayHost";
const NPM_REGISTRY_HOST = "registry.npmjs.org";

type ClaudeSandboxNetworkPolicy = { allow: Record<string, NetworkPolicyRule[]> };

/**
 * Builds the network policy for Claude's board sandbox: the board's own
 * routes from `sandboxPolicy()`, npm to install vb and Claude Code, and AI
 * Gateway. The gateway credential is added by the sandbox proxy on the way
 * out, so it never enters the sandbox. Every other host is blocked.
 *
 * @param params.boardAllow - The `allow` map `sandboxPolicy()` returned.
 * @param params.gatewayToken - AI Gateway key or the deployment's OIDC token.
 * @returns The sandbox network policy.
 */
export function buildClaudeSandboxNetworkPolicy({
  boardAllow,
  gatewayToken,
}: {
  boardAllow: Record<string, NetworkPolicyRule[]>;
  gatewayToken: string;
}): ClaudeSandboxNetworkPolicy {
  return {
    allow: {
      ...boardAllow,
      [NPM_REGISTRY_HOST]: [],
      [AI_GATEWAY_HOST]: [
        { transform: [{ headers: { Authorization: `Bearer ${gatewayToken}` } }] },
      ],
    },
  };
}

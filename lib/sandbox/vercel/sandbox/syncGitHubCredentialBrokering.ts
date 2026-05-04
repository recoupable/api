import type { Sandbox as VercelSandboxSDK } from "@vercel/sandbox";
import { buildGitHubCredentialBrokeringPolicy } from "./buildGitHubCredentialBrokeringPolicy";
import type { SandboxNetworkPolicy } from "./types";

export async function syncGitHubCredentialBrokering(
  sdk: VercelSandboxSDK,
  token?: string,
): Promise<void> {
  const updateNetworkPolicy = (
    sdk as VercelSandboxSDK & {
      updateNetworkPolicy?: (policy: SandboxNetworkPolicy) => Promise<void>;
    }
  ).updateNetworkPolicy;

  if (typeof updateNetworkPolicy !== "function") {
    if (token) {
      throw new Error(
        "Current @vercel/sandbox SDK does not support network policy updates required for GitHub credential brokering",
      );
    }
    return;
  }

  await updateNetworkPolicy.call(sdk, buildGitHubCredentialBrokeringPolicy(token));
}

import type { ProviderMetadata } from "ai";
import type { GatewayProviderMetadata } from "@/lib/agent/messageMetadata/GatewayProviderMetadata";

/**
 * Type guard for the Vercel AI Gateway entry inside a step's
 * `providerMetadata`. Returns true when the metadata has a non-null
 * `gateway` object (cost may still be absent). Splitting this out from
 * `extractGatewayCost` keeps each file to a single responsibility and
 * makes the guard reusable when other gateway fields (e.g.
 * `inferenceCost`) get plumbed through later.
 */
export function hasGatewayShape(
  metadata: ProviderMetadata | undefined,
): metadata is ProviderMetadata & GatewayProviderMetadata {
  if (!metadata) return false;
  const gateway = (metadata as Record<string, unknown>).gateway;
  return typeof gateway === "object" && gateway !== null;
}

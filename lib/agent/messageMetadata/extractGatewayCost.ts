import type { ProviderMetadata } from "ai";
import { hasGatewayShape } from "@/lib/agent/messageMetadata/hasGatewayShape";

/**
 * Extract the gateway-reported cost for a single step.
 * Returns `undefined` when the step did not go through the gateway,
 * the gateway did not attach a cost (e.g. direct provider call), or
 * the cost is malformed.
 *
 * Mirrors open-agents' `apps/web/app/workflows/gateway-metadata.ts`.
 */
export function extractGatewayCost(
  providerMetadata: ProviderMetadata | undefined,
): number | undefined {
  if (!hasGatewayShape(providerMetadata)) return undefined;
  const rawCost = providerMetadata.gateway.cost;
  if (typeof rawCost !== "string") return undefined;
  const cost = Number.parseFloat(rawCost);
  return Number.isFinite(cost) ? cost : undefined;
}

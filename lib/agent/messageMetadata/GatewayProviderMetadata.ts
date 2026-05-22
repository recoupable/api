/**
 * Shape of the Vercel AI Gateway entry in `providerMetadata`.
 * Mirrors open-agents' `apps/web/app/workflows/gateway-metadata.ts`.
 *
 * The gateway surfaces per-step cost information alongside routing
 * diagnostics. We only consume the `cost` field; other fields are
 * documented for reference and forward-compat.
 */
export interface GatewayProviderMetadata {
  gateway: {
    cost?: string;
    marketCost?: string;
    inferenceCost?: string;
    inputInferenceCost?: string;
    outputInferenceCost?: string;
    generationId?: string;
  };
}

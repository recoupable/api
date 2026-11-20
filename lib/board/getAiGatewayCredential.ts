/**
 * Returns the credential the sandbox proxy adds to AI Gateway requests: the
 * AI Gateway API key, else the deployment's OIDC token.
 *
 * @returns The credential. It never enters the sandbox.
 */
export function getAiGatewayCredential(): string {
  const credential = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!credential) {
    throw new Error("No AI Gateway credential: set AI_GATEWAY_API_KEY or enable OIDC");
  }
  return credential;
}

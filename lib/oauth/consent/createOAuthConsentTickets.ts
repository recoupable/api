import { randomBytes, timingSafeEqual } from "node:crypto";
import type { AdapterFactory } from "oidc-provider";
import { z } from "zod";
import { oauthScopes } from "../oauthScopes";

const bindingSchema = z.object({
  uid: z.string().min(1),
  accountId: z.string().uuid(),
  subject: z.string().startsWith("did:privy:"),
  clientId: z.string().min(1),
  resource: z.string().url(),
  scopes: z.array(z.string()).min(1),
});
export type OAuthConsentBinding = z.infer<typeof bindingSchema>;

/** Short-lived, encrypted, one-use approval tickets bound to server-verified identity. */
export function createOAuthConsentTickets(adapter: AdapterFactory) {
  const tickets = adapter("RecoupInteraction");
  const canonical = (input: OAuthConsentBinding) => {
    const binding = bindingSchema.parse(input);
    if (binding.scopes.some(scope => !Object.hasOwn(oauthScopes, scope)))
      throw new Error("Unsupported OAuth permission");
    // Bind the displayed duration too; old 30-day approval tickets must be reloaded.
    return JSON.stringify({
      ...binding,
      scopes: [...new Set(binding.scopes)].sort(),
      accessDurationDays: null,
    });
  };
  return {
    async issue(binding: OAuthConsentBinding) {
      const serialized = canonical(binding);
      const csrf = randomBytes(32).toString("base64url");
      // Nonce is the record ID: concurrent page loads cannot overwrite a consumed marker.
      await tickets.upsert(csrf, { extra: { binding: serialized } }, 300);
      return csrf;
    },
    async consume(csrf: string, binding: OAuthConsentBinding) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(csrf)) throw new Error("Invalid OAuth approval");
      const expected = Buffer.from(canonical(binding));
      const ticket = await tickets.find(csrf);
      const saved = ticket && ticket.extra?.binding;
      if (!ticket || ticket.consumed !== undefined || typeof saved !== "string")
        throw new Error("Invalid OAuth approval");
      const actual = Buffer.from(saved);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
        throw new Error("Invalid OAuth approval");
      // The durable adapter rejects concurrent or repeated consumption atomically.
      await tickets.consume(csrf);
    },
  };
}

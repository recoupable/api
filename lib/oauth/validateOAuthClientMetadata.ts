import { errors, type ClientMetadata } from "oidc-provider";
import { z } from "zod";

const cimd = z.object({
  client_name: z.string().trim().min(1).max(200),
  redirect_uris: z.array(z.string().min(1)).min(1).max(20),
});

/** CIMD display metadata is untrusted; documents must never carry private key material. */
export function validateOAuthClientMetadata(metadata: ClientMetadata): void {
  if (!/^https:\/\//i.test(metadata.client_id ?? "")) return;
  const validated = cimd.safeParse(metadata);
  if (!validated.success) throw new errors.InvalidClientMetadata("Invalid MCP client metadata");
  metadata.client_name = validated.data.client_name;
  for (const key of metadata.jwks?.keys ?? []) {
    if (
      key.kty === "oct" ||
      ["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some(name => name in key)
    ) {
      throw new errors.InvalidClientMetadata("Client metadata must contain only public keys");
    }
  }
}

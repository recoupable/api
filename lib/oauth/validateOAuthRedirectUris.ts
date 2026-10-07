import { errors } from "oidc-provider";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Supplement provider URI validation with a transport policy shared by all client types. */
export function validateOAuthRedirectUris(value: unknown): void {
  // The provider retains responsibility for required fields, types, and URI syntax.
  if (!Array.isArray(value)) return;
  for (const uri of value) {
    if (typeof uri !== "string" || !URL.canParse(uri)) continue;
    const url = new URL(uri);
    if (url.protocol === "http:" && !loopbackHosts.has(url.hostname)) {
      throw new errors.InvalidRedirectUri("HTTP redirect_uris must use a loopback host");
    }
  }
}

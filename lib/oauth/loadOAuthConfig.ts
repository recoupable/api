import { createPrivateKey } from "node:crypto";
import type { Configuration } from "oidc-provider";
import { z } from "zod";
import { createOAuthCipher } from "./createOAuthCipher";

/** Load stable deployment secrets; no generated keys or guessed issuer fallback. */
export function loadOAuthConfig(env: Record<string, string | undefined> = process.env) {
  try {
    const canonical = (value: string, path: string) => {
      const url = new URL(value);
      if (
        (url.protocol !== "https:" &&
          !(url.protocol === "http:" && url.hostname === "127.0.0.1")) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== path ||
        url.href !== value
      )
        throw new Error();
      return url;
    };
    const issuer = canonical(env.OAUTH_ISSUER!, "/api/oauth");
    const consent = canonical(env.OAUTH_CONSENT_URL!, "/oauth/authorize");
    const secret = (value: string) => {
      const bytes = Buffer.from(value, "base64");
      if (bytes.length !== 32 || bytes.toString("base64") !== value) throw new Error();
      return bytes;
    };
    const cookieKeys = z.array(z.string()).min(1).max(3).parse(JSON.parse(env.OAUTH_COOKIE_KEYS!));
    cookieKeys.forEach(secret);
    const encodedKeys = z
      .record(z.string(), z.string())
      .parse(JSON.parse(env.OAUTH_ENCRYPTION_KEYS!));
    const encryptionKeys = Object.fromEntries(
      Object.entries(encodedKeys).map(([id, value]) => [id, secret(value)]),
    );
    const cipher = createOAuthCipher({
      activeKeyId: env.OAUTH_ACTIVE_ENCRYPTION_KEY!,
      keys: encryptionKeys,
    });
    const jwks = z
      .object({
        keys: z
          .array(
            z
              .object({
                kty: z.literal("RSA"),
                kid: z.string().min(1),
                d: z.string(),
                n: z.string(),
                e: z.string(),
                use: z.literal("sig"),
                alg: z.literal("RS256"),
              })
              .passthrough(),
          )
          .min(1)
          .max(3),
      })
      .parse(JSON.parse(env.OAUTH_SIGNING_JWKS!));
    if (new Set(jwks.keys.map(key => key.kid)).size !== jwks.keys.length) throw new Error();
    for (const key of jwks.keys) {
      const parsed = createPrivateKey({ key, format: "jwk" });
      if ((parsed.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error();
    }
    return {
      issuer: issuer.href,
      consentUrl: consent.href,
      consentOrigin: consent.origin,
      resource: `${issuer.origin}/mcp`,
      cookieKeys,
      cipher,
      indexKey: secret(env.OAUTH_INDEX_KEY!),
      jwks: jwks as Configuration["jwks"],
    };
  } catch {
    throw new Error("Invalid OAuth configuration");
  }
}
export type OAuthRuntimeConfig = ReturnType<typeof loadOAuthConfig>;

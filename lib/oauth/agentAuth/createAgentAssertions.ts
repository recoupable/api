import { createPublicKey, randomUUID } from "node:crypto";
import { createLocalJWKSet, importJWK, jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import { AgentRegistrationError } from "./AgentRegistrationError";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";
import type { AgentRegistration } from "./AgentRegistration";

/** Use the issuer's existing RSA signing identity, with a distinct JWT type and audience. */
export function createAgentAssertions(config: OAuthRuntimeConfig, now: () => number) {
  const keys = z
    .array(
      z.object({
        kty: z.literal("RSA"),
        kid: z.string().min(1),
        use: z.literal("sig"),
        alg: z.literal("RS256"),
        n: z.string(),
        e: z.string(),
        d: z.string(),
        p: z.string(),
        q: z.string(),
        dp: z.string(),
        dq: z.string(),
        qi: z.string(),
      }),
    )
    .min(1)
    .parse(config.jwks?.keys);
  const signingKey = keys[0];
  const privateKey = importJWK(signingKey, "RS256");
  const publicKeys = createLocalJWKSet({
    keys: keys.map(key => ({
      ...createPublicKey({ key, format: "jwk" }).export({ format: "jwk" }),
      kid: key.kid,
      use: "sig",
      alg: "RS256",
    })),
  });
  return {
    async issue(record: AgentRegistration) {
      const expires = record.accessExpiresAt!;
      const assertion = await new SignJWT({ client_id: policy.clientId, scope: policy.scope })
        .setProtectedHeader({ typ: "oauth-id-jag+jwt", alg: "RS256", kid: signingKey.kid })
        .setIssuer(config.issuer)
        .setAudience(config.issuer)
        .setSubject(record.id)
        .setIssuedAt(now())
        .setExpirationTime(expires)
        .setJti(randomUUID())
        .sign(await privateKey);
      return {
        identity_assertion: assertion,
        assertion_expires: new Date(expires * 1000).toISOString(),
      };
    },
    async verify(assertion: string) {
      try {
        if (typeof assertion !== "string" || assertion.length > 16384) throw new Error();
        const { payload } = await jwtVerify(assertion, publicKeys, {
          algorithms: ["RS256"],
          typ: "oauth-id-jag+jwt",
          issuer: config.issuer,
          audience: config.issuer,
          requiredClaims: ["sub", "exp", "iat", "jti"],
          currentDate: new Date(now() * 1000),
          maxTokenAge: policy.connectionSeconds,
        });
        if (
          payload.client_id !== policy.clientId ||
          payload.scope !== policy.scope ||
          typeof payload.sub !== "string" ||
          !/^reg_[A-Za-z0-9_-]{43}$/.test(payload.sub) ||
          typeof payload.iat !== "number" ||
          payload.iat > now() ||
          payload.exp! - payload.iat > policy.connectionSeconds
        )
          throw new Error();
        return payload.sub;
      } catch {
        throw new AgentRegistrationError("invalid_grant");
      }
    },
  };
}

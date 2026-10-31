import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import type { AgentRegistration } from "./AgentRegistration";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";
import type { AgentRegistrationContext } from "./createAgentRegistrationContext";

/** Create encrypted, expiring claim state without granting account authority. */
export async function registerAgentIdentity(context: AgentRegistrationContext, loginHint: string) {
  const { store, config, now } = context;
  const email = z.string().trim().toLowerCase().email().max(320).parse(loginHint);
  const opaque = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;
  const id = opaque("reg");
  const claimToken = opaque("clm");
  const attempt = opaque("cla");
  const code = randomInt(1_000_000).toString().padStart(6, "0");
  const createdAt = now();
  const record: AgentRegistration = {
    id,
    email,
    claimHash: store.hash(claimToken),
    attemptHash: store.hash(attempt),
    codeHash: store.hash(`${id}:${code}`),
    createdAt,
    claimExpiresAt: createdAt + policy.claimSeconds,
    status: "pending",
    failedAttempts: 0,
    lastPollAt: null,
    pollInterval: policy.intervalSeconds,
  };
  await store.insert(record);
  const verification = new URL("/oauth/claim", config.consentOrigin);
  verification.searchParams.set("claim_attempt_token", attempt);
  return {
    registration_id: id,
    registration_type: "service_auth",
    claim_url: `${config.issuer}/agent/identity/claim`,
    claim_token: claimToken,
    claim_token_expires: new Date(record.claimExpiresAt * 1000).toISOString(),
    post_claim_scopes: [policy.scope],
    claim: {
      user_code: code,
      verification_uri: verification.href,
      expires_in: policy.claimSeconds,
      interval: policy.intervalSeconds,
    },
  };
}

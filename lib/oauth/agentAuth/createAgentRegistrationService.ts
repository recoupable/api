import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AdapterFactory, Provider } from "oidc-provider";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import type { OAuthStore } from "../OAuthStore";
import { createOAuthConsentTickets } from "../consent/createOAuthConsentTickets";
import { oauthLaunchScopes } from "../oauthLaunchScopes";
import { createAgentRegistrationStore } from "./createAgentRegistrationStore";
import { createAgentRegistrationGrants } from "./createAgentRegistrationGrants";
import { createAgentAssertions } from "./createAgentAssertions";
import { AgentRegistrationError } from "./AgentRegistrationError";
import type { AgentClaimIdentity, AgentRegistration } from "./AgentRegistration";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";

const decisionSchema = z.discriminatedUnion("decision", [
  z.strictObject({
    decision: z.literal("approve"),
    csrf: z.string(),
    user_code: z.string().regex(/^\d{6}$/),
  }),
  z.strictObject({ decision: z.literal("deny"), csrf: z.string() }),
]);
type TokenRequest = { scope?: string; resource?: string };

/** Service-auth ceremony: no account authority exists until matching sign-in and explicit consent. */
export function createAgentRegistrationService(options: {
  config: OAuthRuntimeConfig;
  store: OAuthStore;
  adapter: AdapterFactory;
  provider: Provider;
  accountExists: (accountId: string) => Promise<boolean>;
  now?: () => number;
}) {
  const { config, adapter } = options;
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const store = createAgentRegistrationStore(config, options.store);
  const grants = createAgentRegistrationGrants({ ...options, now });
  const assertions = createAgentAssertions(config, now);
  const tickets = createOAuthConsentTickets(adapter);
  const binding = (record: AgentRegistration, identity: AgentClaimIdentity) => ({
    uid: record.id,
    accountId: identity.accountId,
    subject: identity.subject,
    clientId: policy.clientId,
    resource: config.resource,
    scopes: [policy.scope],
  });
  const checkIdentity = (record: AgentRegistration, identity: AgentClaimIdentity) => {
    if (!identity.verifiedEmails.includes(record.email))
      throw new AgentRegistrationError("account_mismatch", 403);
  };
  const checkRequest = (request: TokenRequest) => {
    if (request.scope !== undefined && request.scope !== policy.scope)
      throw new AgentRegistrationError("invalid_scope");
    if (request.resource !== undefined && request.resource !== config.resource)
      throw new AgentRegistrationError("invalid_target");
  };
  const readAttempt = async (attempt: string, identity: AgentClaimIdentity) => {
    if (!/^cla_[A-Za-z0-9_-]{43}$/.test(attempt)) throw new AgentRegistrationError("invalid_claim");
    const saved = await store.find("user_code", attempt);
    if (!saved || saved.record.claimExpiresAt <= now() || saved.record.status !== "pending")
      throw new AgentRegistrationError("invalid_claim");
    checkIdentity(saved.record, identity);
    return saved;
  };
  return {
    async create(loginHint: string) {
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
    },
    async load(attempt: string, identity: AgentClaimIdentity) {
      const { record } = await readAttempt(attempt, identity);
      return {
        csrf: await tickets.issue(binding(record, identity)),
        accountId: identity.accountId,
        context: "personal",
        clientName: policy.clientName,
        expiresIn: record.claimExpiresAt - now(),
        accessDurationSeconds: policy.connectionSeconds,
        permissions: [{ scope: policy.scope, description: oauthLaunchScopes[policy.scope] }],
      };
    },
    async decide(attempt: string, input: unknown, identity: AgentClaimIdentity) {
      const decision = decisionSchema.parse(input);
      // CAS retries handle simultaneous polls without losing a decision or code-attempt count.
      for (let retry = 0; retry < 12; retry++) {
        const saved = await readAttempt(attempt, identity);
        const { record } = saved;
        if (decision.decision === "approve") {
          const correct = timingSafeEqual(
            Buffer.from(record.codeHash),
            Buffer.from(store.hash(`${record.id}:${decision.user_code}`)),
          );
          if (!correct) {
            const failedAttempts = record.failedAttempts + 1;
            if (
              !(await store.replace(saved, {
                ...record,
                failedAttempts,
                status: failedAttempts >= policy.maxCodeAttempts ? "denied" : "pending",
              }))
            )
              continue;
            throw new AgentRegistrationError("invalid_user_code");
          }
        }
        await tickets.consume(decision.csrf, binding(record, identity));
        // The registration lock, not the browser ticket, decides which account can bind it.
        const approved = decision.decision === "approve";
        const next: AgentRegistration = {
          ...record,
          status: approved ? "approving" : "denied",
          ...(approved
            ? {
                accountId: identity.accountId,
                subject: identity.subject,
                accessExpiresAt: now() + policy.connectionSeconds,
              }
            : {}),
        };
        // A concurrent poll may have advanced the ciphertext after ticket consumption.
        let current = saved;
        let locked = false;
        for (let lockRetry = 0; lockRetry < 12; lockRetry++) {
          if (
            await store.replace(current, {
              ...next,
              lastPollAt: current.record.lastPollAt,
              pollInterval: current.record.pollInterval,
            })
          ) {
            locked = true;
            break;
          }
          current = await readAttempt(attempt, identity);
        }
        if (!locked) throw new AgentRegistrationError("temporarily_unavailable", 503);
        if (!approved) return { status: "denied" };
        try {
          if (!(await options.accountExists(identity.accountId)))
            throw new AgentRegistrationError("invalid_grant");
          await grants.approve(next);
          // Polls cannot change an approving registration; only its lock holder can complete it.
          const pending = await store.find("id", next.id);
          if (
            !pending ||
            pending.record.status !== "approving" ||
            !(await store.replace(pending, { ...pending.record, status: "approved" }))
          )
            throw new AgentRegistrationError("invalid_grant");
        } catch (error) {
          await adapter("Grant").revokeByGrantId(next.id);
          throw error;
        }
        return { status: "approved" };
      }
      throw new AgentRegistrationError("temporarily_unavailable", 503);
    },
    async poll(claimToken: string, request: TokenRequest) {
      checkRequest(request);
      if (!/^clm_[A-Za-z0-9_-]{43}$/.test(claimToken))
        throw new AgentRegistrationError("expired_token");
      for (let retry = 0; retry < 12; retry++) {
        const saved = await store.find("uid", claimToken);
        if (!saved || saved.record.claimExpiresAt <= now())
          throw new AgentRegistrationError("expired_token");
        const { record } = saved;
        if (record.status === "denied") throw new AgentRegistrationError("access_denied");
        if (record.status === "approving")
          throw new AgentRegistrationError("authorization_pending");
        const early = record.lastPollAt !== null && now() < record.lastPollAt + record.pollInterval;
        const next = {
          ...record,
          lastPollAt: now(),
          pollInterval: Math.min(60, record.pollInterval + (early ? 5 : 0)),
        };
        if (!(await store.replace(saved, next))) continue;
        if (early) throw new AgentRegistrationError("slow_down");
        if (record.status !== "approved") throw new AgentRegistrationError("authorization_pending");
        return { ...(await grants.issue(record)), ...(await assertions.issue(record)) };
      }
      throw new AgentRegistrationError("slow_down");
    },
    async exchange(assertion: string, request: TokenRequest) {
      checkRequest(request);
      const id = await assertions.verify(assertion);
      const saved = await store.find("id", id);
      if (!saved) throw new AgentRegistrationError("invalid_grant");
      return grants.issue(saved.record);
    },
    revokeToken: grants.revokeToken,
  };
}

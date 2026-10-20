import type { IncomingMessage, ServerResponse } from "node:http";
import { z, ZodError } from "zod";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import { setOAuthConsentCors } from "../consent/setOAuthConsentCors";
import type { AgentClaimIdentity } from "./AgentRegistration";
import type { createAgentRegistrationService } from "./createAgentRegistrationService";
import { AgentRegistrationError } from "./AgentRegistrationError";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";
import { readAgentRequestBody } from "./readAgentRequestBody";
import { getAgentAuthMarkdown } from "./getAgentAuthMarkdown";

const identityBody = z.strictObject({
  type: z.literal("service_auth"),
  login_hint: z.string().max(320),
});
const claimBody = z.strictObject({ claim_attempt_token: z.string().max(100) });
const completeBody = z.discriminatedUnion("decision", [
  z.strictObject({
    claim_attempt_token: z.string().max(100),
    csrf: z.string().max(100),
    decision: z.literal("approve"),
    user_code: z.string().regex(/^\d{6}$/),
  }),
  z.strictObject({
    claim_attempt_token: z.string().max(100),
    csrf: z.string().max(100),
    decision: z.literal("deny"),
  }),
]);
const claimTokenBody = z.strictObject({
  grant_type: z.literal(policy.claimGrant),
  claim_token: z.string().max(100),
  resource: z.string().optional(),
  scope: z.string().optional(),
});
const assertionBody = z.strictObject({
  grant_type: z.literal(policy.assertionGrant),
  assertion: z.string().max(16384),
  resource: z.string().optional(),
  scope: z.string().optional(),
});

/** Dispatch the profile grants; ordinary OAuth requests retain the provider's original parser. */
export function createAgentRegistrationHandler(options: {
  config: OAuthRuntimeConfig;
  service: ReturnType<typeof createAgentRegistrationService>;
  resolveIdentity: (bearer: string) => Promise<AgentClaimIdentity>;
}) {
  const { config, service, resolveIdentity } = options;
  return async (
    req: IncomingMessage & { body?: string },
    res: ServerResponse,
  ): Promise<boolean> => {
    const path = req.url?.split("?")[0];
    const agentPath = path?.startsWith("/agent/") || path === "/auth.md";
    const formPath = req.method === "POST" && (path === "/token" || path === "/token/revocation");
    if (!agentPath && !formPath) return false;
    const reply = (status: number, body?: unknown) => {
      res.writeHead(status, { "Cache-Control": "no-store", "Content-Type": "application/json" });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    try {
      if (path === "/auth.md" && req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(getAgentAuthMarkdown(config));
        return true;
      }
      if (formPath) {
        const raw = await readAgentRequestBody(req, "application/x-www-form-urlencoded", 56 * 1024);
        // oidc-provider explicitly supports the raw req.body fallback after an upstream parser.
        // Preserve the raw form, including duplicates, when the request belongs to ordinary OAuth.
        req.body = raw;
        const form = new URLSearchParams(raw);
        const profile = form
          .getAll("grant_type")
          .some(type => type === policy.claimGrant || type === policy.assertionGrant);
        if (path === "/token" && !profile) return false;
        if (path === "/token/revocation" && (form.has("client_id") || req.headers.authorization))
          return false;
        for (const key of form.keys())
          if (form.getAll(key).length !== 1) throw new AgentRegistrationError("invalid_request");
        if (req.headers.dpop || req.headers.authorization)
          throw new AgentRegistrationError("invalid_request");
        const body = Object.fromEntries(form);
        if (path === "/token/revocation") {
          const revoke = z
            .strictObject({
              token: z.string().min(1).max(16384),
              // RFC 7009 requires unsupported hints to be ignored, not rejected.
              token_type_hint: z.string().max(100).optional(),
            })
            .parse(body);
          await service.revokeToken(revoke.token);
          reply(200);
        } else if (body.grant_type === policy.claimGrant) {
          const parsed = claimTokenBody.parse(body);
          reply(200, await service.poll(parsed.claim_token, parsed));
        } else {
          const parsed = assertionBody.parse(body);
          reply(200, await service.exchange(parsed.assertion, parsed));
        }
        return true;
      }
      const consent = path === "/agent/identity/claim" || path === "/agent/identity/claim/complete";
      if (
        consent &&
        (!setOAuthConsentCors(req, res, config.consentOrigin) ||
          req.headers.origin !== config.consentOrigin)
      )
        throw new AgentRegistrationError("untrusted_origin", 403);
      if (consent && req.method === "OPTIONS") {
        reply(204);
        return true;
      }
      if (req.method !== "POST") throw new AgentRegistrationError("method_not_allowed", 405);
      if (path !== "/agent/identity" && !consent) {
        reply(404);
        return true;
      }
      let identity: AgentClaimIdentity | undefined;
      if (consent) {
        const bearer = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "");
        if (!bearer) throw new AgentRegistrationError("login_required", 401);
        try {
          identity = await resolveIdentity(bearer[1]);
        } catch {
          throw new AgentRegistrationError("login_required", 401);
        }
      }
      let body: unknown;
      try {
        body = JSON.parse(await readAgentRequestBody(req, "application/json", 16384));
      } catch (error) {
        if (error instanceof AgentRegistrationError) throw error;
        throw new AgentRegistrationError("invalid_request");
      }
      if (path === "/agent/identity")
        reply(200, await service.create(identityBody.parse(body).login_hint));
      else if (path === "/agent/identity/claim")
        reply(200, await service.load(claimBody.parse(body).claim_attempt_token, identity!));
      else {
        const { claim_attempt_token: attempt, ...decision } = completeBody.parse(body);
        reply(200, await service.decide(attempt, decision, identity!));
      }
    } catch (error) {
      if (error instanceof AgentRegistrationError) reply(error.status, { error: error.error });
      else if (error instanceof ZodError) reply(400, { error: "invalid_request" });
      else reply(503, { error: "temporarily_unavailable" });
    }
    return true;
  };
}

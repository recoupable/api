import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { setOAuthConsentCors } from "../consent/setOAuthConsentCors";
import type { AgentClaimIdentity } from "./AgentRegistration";
import type {
  AgentRegistrationHandlerOptions,
  AgentRegistrationReply,
} from "./AgentRegistrationHttp";
import { AgentRegistrationError } from "./AgentRegistrationError";
import { readAgentRequestBody } from "./readAgentRequestBody";

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
/** Authenticate the consent browser before reading identity or decision input. */
export async function handleAgentIdentityRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: AgentRegistrationHandlerOptions,
  reply: AgentRegistrationReply,
) {
  const { config, service, resolveIdentity } = options;
  const path = req.url?.split("?")[0];
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
    identity = await resolveIdentity(bearer[1]);
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
}

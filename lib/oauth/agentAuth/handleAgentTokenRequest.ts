import type { IncomingMessage } from "node:http";
import { z } from "zod";
import type { createAgentRegistrationService } from "./createAgentRegistrationService";
import { AgentRegistrationError } from "./AgentRegistrationError";
import { agentRegistrationPolicy as policy } from "./agentRegistrationPolicy";
import { readAgentRequestBody } from "./readAgentRequestBody";
import type { AgentRegistrationReply } from "./AgentRegistrationHttp";

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

/** Handle only the profile form grants; leave ordinary OAuth forms byte-for-byte intact. */
export async function handleAgentTokenRequest(
  req: IncomingMessage & { body?: string },
  service: ReturnType<typeof createAgentRegistrationService>,
  reply: AgentRegistrationReply,
) {
  const path = req.url?.split("?")[0];
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

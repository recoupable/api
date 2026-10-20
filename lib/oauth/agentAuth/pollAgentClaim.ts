import type { AgentRegistrationContext } from "./createAgentRegistrationContext";
import { AgentRegistrationError } from "./AgentRegistrationError";
import { validateAgentTokenRequest, type AgentTokenRequest } from "./validateAgentTokenRequest";

/** Serialize polls across instances and issue only after explicit account approval. */
export async function pollAgentClaim(
  context: AgentRegistrationContext,
  claimToken: string,
  request: AgentTokenRequest,
) {
  const { config, store, now, grants, assertions } = context;
  validateAgentTokenRequest(config, request);
  if (!/^clm_[A-Za-z0-9_-]{43}$/.test(claimToken))
    throw new AgentRegistrationError("expired_token");
  for (let retry = 0; retry < 12; retry++) {
    const saved = await store.find("uid", claimToken);
    if (!saved || saved.record.claimExpiresAt <= now())
      throw new AgentRegistrationError("expired_token");
    const { record } = saved;
    if (record.status === "denied") throw new AgentRegistrationError("access_denied");
    if (record.status === "approving") throw new AgentRegistrationError("authorization_pending");
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
}

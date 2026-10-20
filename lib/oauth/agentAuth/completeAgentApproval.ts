import type { AgentRegistrationContext } from "./createAgentRegistrationContext";
import type { AgentRegistration } from "./AgentRegistration";
import { AgentRegistrationError } from "./AgentRegistrationError";

/** Only the approval lock holder may create grants; partial issuance revokes the entire family. */
export async function completeAgentApproval(
  context: AgentRegistrationContext,
  record: AgentRegistration,
) {
  const { accountExists, grants, store, adapter } = context;
  try {
    if (!record.accountId || !(await accountExists(record.accountId)))
      throw new AgentRegistrationError("invalid_grant");
    await grants.approve(record);
    // Polls cannot change an approving registration; only its lock holder can complete it.
    const pending = await store.find("id", record.id);
    if (
      !pending ||
      pending.record.status !== "approving" ||
      !(await store.replace(pending, { ...pending.record, status: "approved" }))
    )
      throw new AgentRegistrationError("invalid_grant");
  } catch (error) {
    await adapter("Grant").revokeByGrantId(record.id);
    throw error;
  }
}

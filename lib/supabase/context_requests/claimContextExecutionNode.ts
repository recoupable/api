import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

const claimSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("claimed"), claimId: z.uuid() }),
  z.object({ state: z.literal("unknown"), claimId: z.uuid().optional() }),
]);

/** A replay is uncertain until its saved evidence/outcome is reconciled; never call the provider again. */
export async function claimContextExecutionNode(
  owner: string,
  executionId: string,
  nodeKey: string,
) {
  z.uuid().parse(owner);
  z.uuid().parse(executionId);
  z.string()
    .regex(/^[0-9a-f-]{36}:[a-z][a-z0-9_]{0,99}$/)
    .parse(nodeKey);
  return claimSchema.parse(
    await callContextRpc("claim_context_execution_node", {
      p_owner: owner,
      p_execution: executionId,
      p_node_key: nodeKey,
    }),
  );
}

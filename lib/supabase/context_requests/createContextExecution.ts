import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

const nodeSchema = z.looseObject({
  key: z.string().min(1),
  subjectId: z.uuid(),
  module: z.string().regex(/^[a-z][a-z0-9_]{0,99}$/),
  state: z.enum(["ready_for_dispatch", "reuse_candidate", "blocked", "not_implemented"]),
  dependsOn: z.array(z.string().min(1)).max(100),
});
const planSchema = z.array(nodeSchema).max(100);

/** Store only a server-built plan; database rechecks request ownership and subject membership. */
export async function createContextExecution(
  owner: string,
  requestId: string,
  executionId: string,
  policyVersion: string,
  input: unknown,
) {
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  z.uuid().parse(executionId);
  z.string().min(1).max(100).parse(policyVersion);
  const plan = planSchema.parse(input);
  const keys = new Set<string>();
  for (const node of plan) {
    if (node.key !== `${node.subjectId}:${node.module}` || keys.has(node.key))
      throw new Error("Invalid context execution node");
    keys.add(node.key);
  }
  const visited = new Set<string>();
  while (visited.size < plan.length) {
    const ready = plan.filter(
      node => !visited.has(node.key) && node.dependsOn.every(key => visited.has(key)),
    );
    if (!ready.length) throw new Error("Invalid context execution dependencies");
    ready.forEach(node => visited.add(node.key));
  }
  return callContextRpc("create_context_execution", {
    p_owner: owner,
    p_request: requestId,
    p_execution: executionId,
    p_policy_version: policyVersion,
    p_plan: plan,
  });
}

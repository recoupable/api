import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

const executionSchema = z
  .strictObject({
    executionId: z.uuid(),
    policyVersion: z.string().min(1).max(100),
    createdAt: z.iso.datetime({ offset: true }),
    nodeCount: z.number().int().min(0).max(100),
    outcomeCount: z.number().int().min(0).max(100),
  })
  .refine(row => row.outcomeCount <= row.nodeCount);

/** Service-only; the caller must authorize the actor's selected workspace. */
export async function listContextRequestExecutions(owner: string, requestId: string) {
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  return z.array(executionSchema).parse(
    await callContextRpc("list_context_request_executions", {
      p_owner: owner,
      p_request: requestId,
    }),
  );
}

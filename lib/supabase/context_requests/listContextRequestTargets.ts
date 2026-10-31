import { z } from "zod";
import { callContextRpc } from "./callContextRpc";

import { contextRequestTargetSchema } from "./contextRequestTargetSchema";

/** Service-only lookup. Callers must authorize the actor's selected owner first. */
export async function listContextRequestTargets(owner: string, requestId: string) {
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  return z
    .array(contextRequestTargetSchema)
    .max(100)
    .parse(
      await callContextRpc("list_context_request_targets", {
        p_owner: owner,
        p_request: requestId,
      }),
    );
}

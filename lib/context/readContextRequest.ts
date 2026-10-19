import { authorizeContextOwner } from "./authorizeContextOwner";
import { readContextMaterialEvidence } from "./readContextMaterialEvidence";
import type { ContextOperationDependencies } from "./processContextOperation";

/** Keep transport policy and final read authorization outside action dispatch. */
export async function readContextRequest<T>(input: {
  accountId: string;
  ownerId: string;
  organizationId?: string;
  requestId: string;
  request: T;
  deps: Pick<ContextOperationDependencies, "rpc" | "authorize" | "includeMaterialEvidence">;
}) {
  const { request, deps, accountId, ownerId, organizationId, requestId } = input;
  if (deps.includeMaterialEvidence === false) return { request };
  const materialEvidence = await readContextMaterialEvidence({
    ownerId,
    requestId,
    request,
    rpc: deps.rpc,
  });
  if (materialEvidence === undefined) return { request };
  const current = await (deps.authorize ?? authorizeContextOwner)(accountId, organizationId);
  if (current.ownerId.toLowerCase() !== ownerId.toLowerCase())
    throw new Error("Material evidence owner changed");
  return { request, material_evidence: materialEvidence };
}

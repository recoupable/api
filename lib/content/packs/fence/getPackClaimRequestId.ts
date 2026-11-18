import { createHash } from "node:crypto";
/** Deterministic per workflow/asset acquisition; replay never invents a fresh claim. */
export function getPackClaimRequestId(executionId: string, workflowId: string, assetId: string) {
  const hex = createHash("sha256")
    .update(JSON.stringify([executionId, workflowId, assetId]))
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

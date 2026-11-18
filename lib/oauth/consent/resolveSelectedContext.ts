import { selectedContextSchema } from "../selectedContextSchema";
import { workspaceSelectionSchema } from "./workspaceSelectionSchema";

/** Resolve only an explicit workspace choice against the same authority used by Context. */
export async function resolveSelectedContext(accountId: string, scopes: string[], input: unknown) {
  if (!scopes.includes("mcp:tools"))
    throw new Error("Selected Context requires full scope consent");
  const selection = workspaceSelectionSchema.parse(input);
  const { authorizeContextOwner } = await import("@/lib/context/authorizeContextOwner");
  const owner = await authorizeContextOwner(
    accountId,
    selection.workspace_kind === "organization" ? selection.organization_id : undefined,
  );
  return selectedContextSchema.parse({
    version: 1,
    capabilityVersion: "context-workspace-v1",
    mode: "selected_context",
    kind: selection.workspace_kind,
    ownerId: owner.ownerId,
    organizationId: owner.organizationId,
  });
}

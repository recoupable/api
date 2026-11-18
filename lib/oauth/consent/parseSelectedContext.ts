import { selectedContextSchema } from "../selectedContextSchema";
import { workspaceSelectionSchema } from "./workspaceSelectionSchema";

/** Rebuild ticket attribution only; this does not authorize workspace access. */
export function parseSelectedContext(accountId: string, scopes: string[], input: unknown) {
  if (!scopes.includes("mcp:tools"))
    throw new Error("Selected Context requires full scope consent");
  const selection = workspaceSelectionSchema.parse(input);
  const organizationId =
    selection.workspace_kind === "organization" ? selection.organization_id : null;
  return selectedContextSchema.parse({
    version: 1,
    capabilityVersion: "context-workspace-v1",
    mode: "selected_context",
    kind: selection.workspace_kind,
    ownerId: organizationId ?? accountId,
    organizationId,
  });
}

import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { applicationRegistrationSchema } from "./applicationRegistrationSchema";
import { ApplicationRegistrationError } from "./ApplicationRegistrationError";

/** Shared HTTP/MCP preflight. Does not persist, verify domains, issue credentials, or grant access. */
export async function validateApplicationRegistration(accountId: string, input: unknown) {
  if (!accountId) throw new ApplicationRegistrationError(401, "Authentication required");
  const proposal = applicationRegistrationSchema.parse(input);
  const workspaceId = proposal.organization_id ?? accountId;
  if (
    workspaceId !== accountId &&
    !(await validateOrganizationAccess({ accountId, organizationId: workspaceId }))
  ) {
    throw new ApplicationRegistrationError(403, "Workspace not available");
  }
  for (const value of proposal.allowed_origins) {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const protocolAllowed =
      url.protocol === "https:" ||
      (proposal.environment === "development" && local && url.protocol === "http:");
    if (
      !protocolAllowed ||
      url.origin !== value ||
      value.includes("*") ||
      url.username ||
      url.password ||
      (proposal.environment === "production" && local)
    ) {
      throw new ApplicationRegistrationError(
        400,
        "Use exact HTTPS origins; HTTP loopback origins are development-only",
      );
    }
  }
  for (const value of proposal.return_urls) {
    const url = new URL(value);
    if (
      !proposal.allowed_origins.includes(url.origin) ||
      url.username ||
      url.password ||
      url.hash ||
      value.includes("#") ||
      url.href !== value
    ) {
      throw new ApplicationRegistrationError(
        400,
        "Return URLs must be exact URLs on a proposed origin, without credentials or fragments",
      );
    }
  }
  return {
    status: "validated" as const,
    persisted: false as const,
    origins_verified: false as const,
    workspace_id: workspaceId,
    billing_owner_id: workspaceId,
    name: proposal.name,
    environment: proposal.environment,
    allowed_origins: proposal.allowed_origins,
    return_urls: proposal.return_urls,
  };
}

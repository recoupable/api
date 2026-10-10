import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { contextOperationHandler } from "../contextOperationHandler";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchContextRequest } from "../dispatchContextRequest";
import { dispatchContextReleaseVerification } from "../dispatchContextReleaseVerification";
import { dispatchContextReleaseTrackIsrcs } from "../dispatchContextReleaseTrackIsrcs";
import { buildContextOperationFixture } from "./buildContextOperationFixture";

// Every private sink the domain layer can reach. None may run after a denial.
const sinks = vi.hoisted(() => ({
  callContextRpc: vi.fn(),
  dispatchContextRequest: vi.fn(),
  dispatchContextReleaseVerification: vi.fn(),
  dispatchContextReleaseTrackIsrcs: vi.fn(),
  planStoredContextModules: vi.fn(),
  listContextRequestExecutions: vi.fn(),
  listContextCatalogMembers: vi.fn(),
  expandContextCatalogMembers: vi.fn(),
  listContextCatalogMemberTargets: vi.fn(),
}));
const ids = vi.hoisted(() => ({
  actor: "11111111-1111-4111-8111-111111111111",
  organization: "22222222-2222-4222-8222-222222222222",
  canary: "CANARY-private-membership-detail-7f3a",
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({
  callContextRpc: sinks.callContextRpc,
}));
vi.mock("../dispatchContextRequest", () => ({
  dispatchContextRequest: sinks.dispatchContextRequest,
}));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: sinks.dispatchContextReleaseVerification,
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: sinks.dispatchContextReleaseTrackIsrcs,
}));
vi.mock("../planning/planStoredContextModules", () => ({
  planStoredContextModules: sinks.planStoredContextModules,
}));
vi.mock("@/lib/supabase/context_requests/listContextRequestExecutions", () => ({
  listContextRequestExecutions: sinks.listContextRequestExecutions,
}));
vi.mock("@/lib/supabase/context_requests/listContextCatalogMembers", () => ({
  listContextCatalogMembers: sinks.listContextCatalogMembers,
}));
vi.mock("@/lib/supabase/context_requests/expandContextCatalogMembers", () => ({
  expandContextCatalogMembers: sinks.expandContextCatalogMembers,
}));
vi.mock("@/lib/supabase/context_requests/listContextCatalogMemberTargets", () => ({
  listContextCatalogMemberTargets: sinks.listContextCatalogMemberTargets,
}));
// Real transports and real domain dispatcher; only identity lookups and membership are faked.
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(async () => ids.actor),
}));
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({ getAuthenticatedAccountId: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));
vi.mock("../authorizeContextOwner", async importOriginal => {
  const actual = await importOriginal<typeof import("../authorizeContextOwner")>();
  return { authorizeContextOwner: vi.fn(actual.authorizeContextOwner) };
});
vi.mock("../processContextOperation", async importOriginal => {
  const actual = await importOriginal<typeof import("../processContextOperation")>();
  return { ...actual, processContextOperation: vi.fn(actual.processContextOperation) };
});

const { actor, organization, canary } = ids;
const sharedDependencies = {
  rpc: callContextRpc,
  dispatch: dispatchContextRequest,
  dispatchRelease: dispatchContextReleaseVerification,
  dispatchReleaseTracks: dispatchContextReleaseTrackIsrcs,
};
const operations = contextOperationSchema.options.map(option => ({
  action: option.shape.action.value as string,
  option,
  // Organization scope is the only scope where membership can be denied or revoked.
  operation: option.parse({
    ...buildContextOperationFixture(option),
    organization_id: organization,
  }),
}));

function callHttp(operation: Record<string, unknown>) {
  return contextOperationHandler(
    new NextRequest("http://localhost/api/context", {
      method: "POST",
      headers: { "x-api-key": "fixture-key", "content-type": "application/json" },
      body: JSON.stringify(operation),
    }),
  );
}
async function callMcp(operation: Record<string, unknown>) {
  const registerTool = vi.fn();
  registerContextTool({ registerTool } as never);
  const result = await registerTool.mock.calls[0][2](operation, {
    authInfo: { extra: { accountId: actor } },
  });
  return { result, text: result.content[0].text as string };
}
function expectNoPrivateSink() {
  for (const [name, sink] of Object.entries(sinks))
    expect(sink, `${name} ran after a denial`).not.toHaveBeenCalled();
}

afterEach(() => vi.resetAllMocks());

describe.each(operations)("Context ownership parity: $action", ({ option, operation }) => {
  it("authorized: both transports pass the authenticated actor to one shared operation", async () => {
    expect(option.safeParse(operation).success).toBe(true);
    vi.mocked(validateOrganizationAccess).mockResolvedValue(true);

    const response = await callHttp(operation);
    expect([400, 401, 403]).not.toContain(response.status);
    expect(processContextOperation).toHaveBeenCalledExactlyOnceWith(
      actor,
      operation,
      expect.objectContaining(sharedDependencies),
    );
    expect(authorizeContextOwner).toHaveBeenCalledExactlyOnceWith(actor, organization);
    // HTTP checks membership at the transport and again inside the domain layer.
    expect(validateOrganizationAccess).toHaveBeenCalledTimes(2);

    vi.clearAllMocks();
    vi.mocked(validateOrganizationAccess).mockResolvedValue(true);
    await callMcp(operation);
    expect(processContextOperation).toHaveBeenCalledExactlyOnceWith(
      actor,
      operation,
      expect.objectContaining(sharedDependencies),
    );
    expect(authorizeContextOwner).toHaveBeenCalledExactlyOnceWith(actor, organization);
    expect(validateOrganizationAccess).toHaveBeenCalledExactlyOnceWith({
      accountId: actor,
      organizationId: organization,
    });
  });

  it("denied in the domain layer: opaque failure through both transports, no private sink", async () => {
    // Transport membership passes (a stale grant); the domain recheck fails with private detail.
    vi.mocked(validateOrganizationAccess).mockResolvedValue(true);
    vi.mocked(authorizeContextOwner).mockRejectedValue(new Error(`Access denied: ${canary}`));

    const response = await callHttp(operation);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toEqual({ error: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain(canary);
    expect(JSON.stringify(body)).not.toContain(organization);
    expect(processContextOperation).toHaveBeenCalledTimes(1);
    expectNoPrivateSink();

    const { result, text } = await callMcp(operation);
    expect(JSON.parse(text)).toEqual({ success: false, message: expect.any(String) });
    expect(JSON.stringify(result)).not.toContain(canary);
    expect(JSON.stringify(result)).not.toContain(organization);
    expect(processContextOperation).toHaveBeenCalledTimes(2);
    expect(authorizeContextOwner).toHaveBeenCalledTimes(2);
    expectNoPrivateSink();
  });

  it("denied organization membership: HTTP stops at the transport, MCP in the domain layer", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(false);

    const response = await callHttp(operation);
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain(organization);
    expect(processContextOperation).not.toHaveBeenCalled();
    expect(authorizeContextOwner).not.toHaveBeenCalled();
    expectNoPrivateSink();

    const { result, text } = await callMcp(operation);
    expect(JSON.parse(text)).toEqual({ success: false, message: expect.any(String) });
    expect(JSON.stringify(result)).not.toContain(organization);
    expect(processContextOperation).toHaveBeenCalledExactlyOnceWith(
      actor,
      operation,
      expect.objectContaining(sharedDependencies),
    );
    expect(authorizeContextOwner).toHaveBeenCalledExactlyOnceWith(actor, organization);
    expect(validateOrganizationAccess).toHaveBeenLastCalledWith({
      accountId: actor,
      organizationId: organization,
    });
    expectNoPrivateSink();
  });
});

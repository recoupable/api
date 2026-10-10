import { afterEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { registerFullOAuthTools } from "@/lib/mcp/oauth/registerFullOAuthTools";
import { contextToolOperations } from "@/lib/mcp/oauth/contextToolOperations";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchContextRequest } from "../dispatchContextRequest";
import { dispatchContextReleaseVerification } from "../dispatchContextReleaseVerification";
import { dispatchContextReleaseTrackIsrcs } from "../dispatchContextReleaseTrackIsrcs";
import { buildContextOperationFixture } from "./buildContextOperationFixture";

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
  owner: "11111111-1111-4111-8111-111111111111",
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
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(async () => true),
}));
vi.mock("../authorizeContextOwner", async importOriginal => {
  const actual = await importOriginal<typeof import("../authorizeContextOwner")>();
  return { authorizeContextOwner: vi.fn(actual.authorizeContextOwner) };
});
vi.mock("../processContextOperation", async importOriginal => {
  const actual = await importOriginal<typeof import("../processContextOperation")>();
  return { ...actual, processContextOperation: vi.fn(actual.processContextOperation) };
});
// The delegated catalog is derived from the real Context tool, not a hand-written copy.
vi.mock("@/lib/mcp/tools", async () => {
  const { registerContextTool } = await import("@/lib/mcp/tools/context/registerContextTool");
  return { registerAllTools: (server: McpServer) => registerContextTool(server) };
});

const { owner, organization, canary } = ids;
const access = {
  accountId: owner,
  clientId: "client",
  grantId: "grant",
  scopes: ["mcp:tools"],
  expiresAt: 9999999999,
  resource: "https://api.recoupable.dev/mcp",
  context: "personal" as const,
};
const extra = {
  authInfo: {
    token: "secret",
    clientId: "client",
    scopes: access.scopes,
    extra: { accountId: owner, oauth: access },
  },
};
const operations = contextOperationSchema.options.map(option => {
  const action = option.shape.action.value as keyof typeof contextToolOperations;
  const input: Record<string, unknown> = {
    ...buildContextOperationFixture(option),
    organization_id: organization,
  };
  delete input.action;
  return { action, option, input, expected: option.parse({ ...input, action }) };
});

function setup() {
  const registered = new Map<string, { config: any; run: any }>();
  const server = {
    registerTool: vi.fn((name, config, run) => registered.set(name, { config, run })),
  };
  const prepare = vi.fn(async (_name: string, args: Record<string, unknown>) => args);
  registerFullOAuthTools(server as unknown as McpServer, vi.fn().mockResolvedValue(access), {
    prepare,
    listArtists: vi.fn().mockResolvedValue([]),
  });
  return { registered, prepare };
}

afterEach(() => vi.resetAllMocks());

it("registers exactly one delegated tool per Context action", () => {
  const { registered } = setup();
  const expected = Object.values(contextToolOperations).map(operation => operation.name);
  expect([...registered.keys()].filter(name => name !== "list_artists").sort()).toEqual(
    [...expected].sort(),
  );
  expect(registered.size).toBe(contextOperationSchema.options.length + 1);
});

describe.each(operations)("OAuth Context parity: $action", ({ action, input, expected }) => {
  const metadata = contextToolOperations[action];

  it("exposes the action-free schema with the catalog's permission classification", () => {
    const { registered } = setup();
    const tool = registered.get(metadata.name)!;
    // Context writes save idempotent evidence; no action deletes, so none is destructive.
    expect(tool.config.annotations).toMatchObject({
      readOnlyHint: metadata.readOnly,
      destructiveHint: false,
    });
    expect(tool.config.inputSchema.shape.action).toBeUndefined();
    expect(tool.config.inputSchema.safeParse(input).success).toBe(true);
    expect(tool.config.inputSchema.safeParse({ ...input, action }).success).toBe(false);
    expect(tool.config.inputSchema.safeParse({ ...input, account_id: owner }).success).toBe(false);
  });

  it("re-injects the action and forwards the verified identity to the shared operation", async () => {
    const { registered, prepare } = setup();
    await registered.get(metadata.name)!.run(input, extra);
    expect(prepare).toHaveBeenCalledExactlyOnceWith("context", expected, owner);
    expect(processContextOperation).toHaveBeenCalledExactlyOnceWith(
      owner,
      expected,
      expect.objectContaining({
        rpc: callContextRpc,
        dispatch: dispatchContextRequest,
        dispatchRelease: dispatchContextReleaseVerification,
        dispatchReleaseTracks: dispatchContextReleaseTrackIsrcs,
      }),
    );
    expect(authorizeContextOwner).toHaveBeenCalledExactlyOnceWith(owner, organization);
  });

  it("returns an opaque result when the domain layer denies the actor", async () => {
    vi.mocked(authorizeContextOwner).mockRejectedValue(new Error(`Access denied: ${canary}`));
    const { registered } = setup();
    const result = await registered.get(metadata.name)!.run(input, extra);
    expect(JSON.parse(result.content[0].text)).toEqual({
      success: false,
      message: expect.any(String),
    });
    expect(JSON.stringify(result)).not.toContain(canary);
    expect(JSON.stringify(result)).not.toContain(organization);
    expect(processContextOperation).toHaveBeenCalledTimes(1);
    for (const [name, sink] of Object.entries(sinks))
      expect(sink, `${name} ran after a denial`).not.toHaveBeenCalled();
  });
});

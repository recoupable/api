import { expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { prepareFullOAuthTool } from "../prepareFullOAuthTool";

const mocks = vi.hoisted(() => ({
  organizations: vi.fn(),
  operation: vi.fn(async () => ({ content: [{ type: "text" as const, text: "fixture result" }] })),
}));
// Synthetic business operations isolate authorization from writes and external providers.
vi.mock("../../tools", () => ({
  registerAllTools: (server: McpServer) => {
    for (const [name, field] of [
      ["create_new_artist", "organization_id"],
      ["get_workspace_player_fans", "organizationId"],
    ]) {
      server.registerTool(
        name,
        { inputSchema: z.object({ [field]: z.string(), account_id: z.string().optional() }) },
        mocks.operation,
      );
    }
  },
}));
vi.mock("../checkFullOAuthRateLimit", () => ({ checkFullOAuthRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: mocks.organizations,
}));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/artists/getArtists", () => ({ getArtists: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: vi.fn(),
}));
vi.mock("@/lib/catalog/getCatalogOwnerIds", () => ({ getCatalogOwnerIds: vi.fn() }));
vi.mock("@/lib/supabase/rooms/selectRoom", () => ({ default: vi.fn() }));
vi.mock("@/lib/emails/assertRecipientsAllowed", () => ({ assertRecipientsAllowed: vi.fn() }));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));

const access = {
  accountId: "fixture-owner",
  clientId: "fixture-client",
  grantId: "fixture-grant",
  scopes: ["mcp:tools"],
  expiresAt: 9999999999,
  resource: "https://api.example/mcp",
  context: "personal" as const,
};
const extra = {
  authInfo: {
    token: "synthetic-token",
    clientId: access.clientId,
    scopes: access.scopes,
    extra: { accountId: access.accountId, oauth: access },
  },
};
type Handler = (args: Record<string, unknown>, context: typeof extra) => Promise<CallToolResult>;

it.each([
  ["create_new_artist", "organization_id"],
  ["get_workspace_player_fans", "organizationId"],
])("rechecks membership before execution with the same valid grant: %s", async (name, field) => {
  vi.clearAllMocks();
  let memberships = ["removed-workspace", "retained-workspace"];
  mocks.organizations.mockImplementation(async () =>
    memberships.map(organization_id => ({ organization_id })),
  );
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (tool: string, _config: unknown, handler: Handler) => handlers.set(tool, handler),
  };
  const verify = vi.fn().mockResolvedValue(access);
  const execute = vi.fn(async (_name, _args, _accountId, run: () => Promise<CallToolResult>) =>
    run(),
  );
  registerFullOAuthTools(server as unknown as McpServer, verify, {
    prepare: prepareFullOAuthTool,
    execute,
    listArtists: vi.fn(),
  });
  const run = handlers.get(name)!;
  const removedArgs = { [field]: "removed-workspace" };
  expect((await run(removedArgs, extra)).isError).not.toBe(true);
  expect((await run({ [field]: "retained-workspace" }, extra)).isError).not.toBe(true);
  expect(mocks.operation).toHaveBeenCalledTimes(2);
  expect(execute).toHaveBeenCalledTimes(2);

  // Only membership changes: the same handler, token, grant and arguments remain valid.
  memberships = ["retained-workspace"];
  const denied = await run(removedArgs, extra);
  expect(denied.isError).toBe(true);
  expect(JSON.stringify(denied)).not.toContain(extra.authInfo.token);
  expect(mocks.operation).toHaveBeenCalledTimes(2);
  expect(execute).toHaveBeenCalledTimes(2);

  expect((await run({ [field]: "retained-workspace" }, extra)).isError).not.toBe(true);
  expect(mocks.operation).toHaveBeenCalledTimes(3);
  expect(execute).toHaveBeenLastCalledWith(
    name,
    { [field]: "retained-workspace", account_id: access.accountId },
    access.accountId,
    expect.any(Function),
  );
  expect(verify).toHaveBeenCalledTimes(4);
  for (const call of verify.mock.calls) expect(call).toEqual([extra.authInfo.token]);
  expect(mocks.organizations).toHaveBeenCalledTimes(4);
  for (const call of mocks.organizations.mock.calls)
    expect(call).toEqual([{ accountId: access.accountId }]);
});

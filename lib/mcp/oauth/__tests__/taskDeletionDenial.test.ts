import { beforeEach, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { prepareFullOAuthTool } from "../prepareFullOAuthTool";

const mocks = vi.hoisted(() => ({
  tasks: vi.fn(),
  remove: vi.fn(),
  schedule: vi.fn(),
  access: vi.fn(),
  budget: vi.fn(),
}));
// Exercise the real callback and domain while all effects remain synthetic.
vi.mock("../../tools", async () => {
  const { registerDeleteTaskTool } = await import("../../tools/tasks/registerDeleteTaskTool");
  return { registerAllTools: registerDeleteTaskTool };
});
vi.mock("@/lib/supabase/scheduled_actions/deleteScheduledAction", () => ({
  deleteScheduledAction: mocks.remove,
}));
vi.mock("@/lib/trigger/deleteSchedule", () => ({ deleteSchedule: mocks.schedule }));
vi.mock("../checkFullOAuthRateLimit", () => ({ checkFullOAuthRateLimit: mocks.budget }));
vi.mock("@/lib/emails/assertRecipientsAllowed", () => ({ assertRecipientsAllowed: vi.fn() }));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: vi.fn() }));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: mocks.tasks,
}));
vi.mock("@/lib/artists/getArtists", () => ({ getArtists: vi.fn() }));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: vi.fn(),
}));
vi.mock("@/lib/catalog/getCatalogOwnerIds", () => ({ getCatalogOwnerIds: vi.fn() }));
vi.mock("@/lib/supabase/rooms/selectRoom", () => ({ default: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: mocks.access }));

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

const taskId = "11111111-1111-4111-8111-111111111111";
let owner: string;
function fixture() {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => handlers.set(name, handler),
  };
  const verify = vi.fn().mockResolvedValue(access);
  registerFullOAuthTools(server as unknown as McpServer, verify, {
    prepare: prepareFullOAuthTool,
    listArtists: vi.fn(),
  });
  return { run: handlers.get("delete_task")!, verify };
}

beforeEach(() => {
  vi.resetAllMocks();
  owner = access.accountId;
  mocks.tasks.mockImplementation(async (query: { account_id?: string }) =>
    query.account_id && query.account_id !== owner
      ? []
      : [{ id: taskId, account_id: owner, trigger_schedule_id: "synthetic-schedule" }],
  );
  // Broad first-party access intentionally cannot override delegated ownership.
  mocks.access.mockResolvedValue(true);
});
function noEffects() {
  expect(mocks.schedule).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
}
it("rechecks ownership after registration before the real deletion callback can act", async () => {
  const { run } = fixture();
  owner = "organization-peer";
  const denied = await run({ id: taskId }, extra);
  expect(denied.isError).toBe(true);
  expect(mocks.tasks).toHaveBeenCalledExactlyOnceWith({ id: taskId, account_id: access.accountId });
  expect(mocks.access).not.toHaveBeenCalled();
  noEffects();
});
it("rejects a newly revoked grant before reads, budgets or deletion", async () => {
  const { run, verify } = fixture();
  verify.mockResolvedValue(undefined);
  expect((await run({ id: taskId }, extra)).isError).toBe(true);
  expect(mocks.tasks).not.toHaveBeenCalled();
  expect(mocks.budget).not.toHaveBeenCalled();
  noEffects();
});
it("rejects owner override before resource reads or deletion", async () => {
  const { run } = fixture();
  expect((await run({ id: taskId, account_id: "peer" }, extra)).isError).toBe(true);
  expect(mocks.tasks).not.toHaveBeenCalled();
  noEffects();
});
it("fails closed on ownership lookup failure without exposing backend details", async () => {
  const { run } = fixture();
  mocks.tasks.mockRejectedValue(new Error("private-backend-canary"));
  const result = await run({ id: taskId }, extra);
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/private-backend-canary|synthetic-token/);
  noEffects();
});
it("honors a later domain access denial before either effect", async () => {
  const { run } = fixture();
  mocks.access.mockResolvedValue(false);
  const result = await run({ id: taskId }, extra);
  expect(JSON.stringify(result)).toContain("Access denied to this task");
  noEffects();
});
it("allows owned deletion only after verification, delegated ownership and domain access", async () => {
  const { run, verify } = fixture();
  const result = await run({ id: taskId }, extra);
  expect(result.isError).not.toBe(true);
  expect(mocks.schedule).toHaveBeenCalledExactlyOnceWith("synthetic-schedule");
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(taskId);
  const first = (mock: { mock: { invocationCallOrder: number[] } }) =>
    mock.mock.invocationCallOrder[0];
  expect(first(verify)).toBeLessThan(first(mocks.budget));
  expect(first(mocks.budget)).toBeLessThan(first(mocks.tasks));
  expect(first(mocks.tasks)).toBeLessThan(first(mocks.access));
  expect(first(mocks.access)).toBeLessThan(first(mocks.schedule));
  expect(first(mocks.access)).toBeLessThan(first(mocks.remove));
});
it("preserves broader first-party domain access independently of delegated ownership", async () => {
  const { deleteTask } = await import("@/lib/tasks/deleteTask");
  owner = "organization-peer";
  await deleteTask({ id: taskId, resolvedAccountId: access.accountId });
  expect(mocks.access).toHaveBeenCalledWith({
    currentAccountId: access.accountId,
    targetAccountId: owner,
  });
  expect(mocks.remove).toHaveBeenCalledOnce();
  expect(mocks.schedule).toHaveBeenCalledOnce();
});

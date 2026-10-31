import { beforeEach, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { prepareFullOAuthTool } from "../prepareFullOAuthTool";

const mocks = vi.hoisted(() => ({ payment: vi.fn(), emails: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/const", () => ({ RECOUP_FROM_EMAIL: "Fixture <sender@example.test>" }));
// Register the real email callback without importing unrelated tools or their providers.
vi.mock("../../tools", async () => {
  const { registerSendEmailTool } = await import("../../tools/registerSendEmailTool");
  return { registerAllTools: registerSendEmailTool };
});
vi.mock("@/lib/emails/processAndSendEmail", () => ({ processAndSendEmail: mocks.send }));
vi.mock("@/lib/stripe/accountHasPaymentMethod", () => ({ accountHasPaymentMethod: mocks.payment }));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: mocks.emails }));
vi.mock("../checkFullOAuthRateLimit", () => ({ checkFullOAuthRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
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

const message = { to: ["owner@example.test"], subject: "Synthetic fixture", text: "No delivery" };
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
  return { run: handlers.get("send_email")!, verify };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.payment.mockResolvedValue(false);
  mocks.emails.mockResolvedValue([{ email: "owner@example.test" }]);
  mocks.send.mockResolvedValue({
    success: true,
    id: "synthetic-receipt",
    message: "Fixture accepted",
  });
});

it.each([{ to: ["foreign@example.test"] }, { cc: ["foreign@example.test"] }])(
  "denies disallowed recipients before the real email callback invokes sending: %j",
  async change => {
    const { run } = fixture();
    const result = await run({ ...message, ...change }, extra);
    expect(result.isError).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.payment).toHaveBeenCalledWith(access.accountId);
    expect(mocks.emails).toHaveBeenCalledWith({ accountIds: access.accountId });
    expect(JSON.stringify(result)).not.toContain(extra.authInfo.token);
  },
);

it("rechecks recipient eligibility on the same valid connection before a later send", async () => {
  const { run } = fixture();
  mocks.payment.mockResolvedValue(true);
  const args = { ...message, to: ["foreign@example.test"] };
  expect((await run(args, extra)).isError).not.toBe(true);
  expect(mocks.send).toHaveBeenCalledOnce();
  mocks.payment.mockResolvedValue(false);
  expect((await run(args, extra)).isError).toBe(true);
  expect(mocks.send).toHaveBeenCalledOnce();
});

it("fails closed before sending when recipient eligibility lookup fails", async () => {
  const { run } = fixture();
  mocks.payment.mockRejectedValue(new Error("synthetic-private-provider-detail"));
  const result = await run(message, extra);
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).not.toContain("synthetic-private-provider-detail");
  expect(mocks.send).not.toHaveBeenCalled();
});

it("rejects a revoked grant before recipient lookup or sending", async () => {
  const { run, verify } = fixture();
  verify.mockResolvedValue(undefined);
  expect((await run(message, extra)).isError).toBe(true);
  expect(mocks.payment).not.toHaveBeenCalled();
  expect(mocks.emails).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});

it("rejects owner overrides before recipient lookup or sending", async () => {
  const { run } = fixture();
  expect((await run({ ...message, account_id: "foreign-owner" }, extra)).isError).toBe(true);
  expect(mocks.payment).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});

it("allows an own-address control while dropping all custom routing headers", async () => {
  const { run } = fixture();
  const result = await run(
    { ...message, headers: { Bcc: "foreign@example.test", "Reply-To": "foreign@example.test" } },
    extra,
  );
  expect(result.isError).not.toBe(true);
  expect(mocks.send).toHaveBeenCalledOnce();
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ ...message, headers: {} }));
  const text = result.content[0];
  expect(text.type === "text" && text.text).toContain("synthetic-receipt");
});

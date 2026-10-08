import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { professionalRosterHandler } from "../professionalRosterHandler";
import { registerProfessionalRosterTools } from "@/lib/mcp/tools/artists/registerProfessionalRosterTools";
import { ProfessionalRosterError } from "../ProfessionalRosterError";
import { executeProfessionalRoster } from "@/lib/supabase/organization_professionals/executeProfessionalRoster";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
vi.mock("@/lib/supabase/organization_professionals/executeProfessionalRoster", () => ({
  executeProfessionalRoster: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
const actor = "10000000-0000-4000-8000-000000000001";
const org = "10000000-0000-4000-8000-000000000002";
const id = "10000000-0000-4000-8000-000000000003";
const body = {
  organization_id: org,
  idempotency_key: id,
  mode: "new",
  name: "Test Writer",
  roles: ["songwriter", "producer"],
  confirmed: true,
  roster_intent: "add",
};
const professional = {
  id,
  organization_id: org,
  name: "Test Writer",
  roles: ["producer", "songwriter"],
  confirmed_by: actor,
  confirmation_basis: "operator_confirmed",
  created_at: "2026-10-08T00:00:00Z",
  updated_at: "2026-10-08T00:00:00Z",
};
const request = (data: unknown = body) =>
  new NextRequest("https://api.example/api/organizations/professionals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: actor,
    orgId: org,
    authToken: "fixture",
  });
  vi.mocked(resolveAccountId).mockResolvedValue({ accountId: actor, error: null });
  vi.mocked(executeProfessionalRoster).mockResolvedValue({ professional, created: true });
});
it("REST authenticates the organization and passes both explicit roles to the shared store", async () => {
  const response = await professionalRosterHandler(request());
  expect(response.status).toBe(201);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ professional, created: true });
  expect(validateAuthContext).toHaveBeenCalledWith(expect.anything(), { organizationId: org });
  expect(executeProfessionalRoster).toHaveBeenCalledWith(actor, body);
});
it.each([
  { confirmed: false },
  { roster_intent: "research" },
  { roles: [] },
  { roles: ["songwriter", "songwriter"] },
  { roles: ["owner"] },
  { mode: "existing" },
  { name: " " },
  { account_id: id },
])("rejects invalid or unconfirmed input before storage: %j", async patch => {
  expect((await professionalRosterHandler(request({ ...body, ...patch }))).status).toBe(400);
  expect(executeProfessionalRoster).not.toHaveBeenCalled();
});
it("auth denial never reaches storage", async () => {
  vi.mocked(validateAuthContext).mockResolvedValue(
    NextResponse.json({ error: "Denied" }, { status: 403 }),
  );
  expect((await professionalRosterHandler(request())).status).toBe(403);
  expect(executeProfessionalRoster).not.toHaveBeenCalled();
});
it("membership revoked at the database is denied after transport authentication", async () => {
  vi.mocked(executeProfessionalRoster).mockRejectedValue(
    new ProfessionalRosterError("Access denied", 403),
  );
  expect((await professionalRosterHandler(request())).status).toBe(403);
});
it("lists a scoped cursor page through the same operation", async () => {
  vi.mocked(executeProfessionalRoster).mockResolvedValue({
    professionals: [professional],
    next_cursor: id,
  });
  const result = await professionalRosterHandler(
    new NextRequest(
      `https://api.example/api/organizations/professionals?organization_id=${org}&after=${id}`,
    ),
  );
  expect(result.status).toBe(200);
  expect(executeProfessionalRoster).toHaveBeenCalledWith(actor, {
    organization_id: org,
    after: id,
  });
});
it("sanitizes unexpected storage errors and invalid response shapes", async () => {
  vi.mocked(executeProfessionalRoster).mockRejectedValueOnce(new Error("secret database detail"));
  let response = await professionalRosterHandler(request());
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("secret");
  vi.mocked(executeProfessionalRoster).mockResolvedValueOnce({
    professional: { id },
    created: true,
  });
  response = await professionalRosterHandler(request());
  expect(response.status).toBe(503);
});
it("MCP and REST use the same confirmation contract and authenticated actor", async () => {
  const server = new McpServer({ name: "fixture", version: "1" });
  const register = vi.spyOn(server, "registerTool");
  registerProfessionalRosterTools(server);
  const call = register.mock.calls.find(args => args[0] === "confirm_professional_roster")!;
  const handler = call[2];
  const extra = {
    authInfo: { token: "fixture", clientId: "fixture", scopes: [] },
    requestId: "fixture",
    signal: new AbortController().signal,
    sendNotification: vi.fn(),
    sendRequest: vi.fn(),
  };
  const result = await handler(body, extra);
  expect(result.isError).not.toBe(true);
  expect(resolveAccountId).toHaveBeenCalledWith({
    authInfo: extra.authInfo,
    accountIdOverride: undefined,
  });
  expect(executeProfessionalRoster).toHaveBeenCalledWith(actor, body);
  vi.mocked(executeProfessionalRoster).mockClear();
  const denied = await handler({ ...body, confirmed: false }, extra);
  expect(denied.isError).toBe(true);
  expect(executeProfessionalRoster).not.toHaveBeenCalled();
});

it("denies unauthorized GET without reading storage", async () => {
  vi.mocked(validateAuthContext).mockResolvedValue(
    NextResponse.json({ error: "Denied" }, { status: 403 }),
  );
  const result = await professionalRosterHandler(
    new NextRequest(`https://api.example/api/organizations/professionals?organization_id=${org}`),
  );
  expect(result.status).toBe(403);
  expect(executeProfessionalRoster).not.toHaveBeenCalled();
});
it("MCP list preserves authenticated organization and cursor and returns the page", async () => {
  const page = { professionals: [professional], next_cursor: id };
  vi.mocked(executeProfessionalRoster).mockResolvedValue(page);
  const server = new McpServer({ name: "fixture", version: "1" });
  const register = vi.spyOn(server, "registerTool");
  registerProfessionalRosterTools(server);
  const handler = register.mock.calls.find(args => args[0] === "list_professional_roster")![2];
  const result = await handler(
    { organization_id: org, after: id },
    {
      authInfo: { token: "fixture", clientId: "fixture", scopes: [] },
      requestId: "fixture",
      signal: new AbortController().signal,
      sendNotification: vi.fn(),
      sendRequest: vi.fn(),
    },
  );
  expect(executeProfessionalRoster).toHaveBeenCalledWith(actor, {
    organization_id: org,
    after: id,
  });
  expect(result.isError).not.toBe(true);
  expect(result.content).toEqual([{ type: "text", text: JSON.stringify(page) }]);
});

it("rejects delegated OAuth even if a legacy roster handler is invoked directly", async () => {
  const { handleProfessionalRosterTool } = await import("../handleProfessionalRosterTool");
  const result = await handleProfessionalRosterTool(
    "list",
    { organization_id: org },
    {
      token: "fixture",
      clientId: "fixture",
      scopes: ["mcp:read"],
      extra: {
        accountId: actor,
        oauth: {
          accountId: actor,
          clientId: "fixture",
          grantId: "fixture",
          scopes: ["mcp:read"],
          expiresAt: 9999999999,
          resource: "https://api.example/mcp",
          context: "personal",
        },
      },
    },
  );
  expect(result.isError).toBe(true);
  expect(resolveAccountId).not.toHaveBeenCalled();
  expect(executeProfessionalRoster).not.toHaveBeenCalled();
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { contextOperationHandler } from "../contextOperationHandler";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { contextToolOperations } from "@/lib/mcp/oauth/contextToolOperations";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: vi.fn() }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(),
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: vi.fn(),
}));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const caseId = "33333333-3333-4333-8333-333333333333";
const snapshot = {
  schema_version: 1,
  case_id: caseId,
  workspace_id: owner,
  revision: 0,
  scope: "Local composition",
  sources: {},
  assessments: {},
  findings: {},
  actions: {},
  attempts: {},
  outcomes: {},
};
const receipt = {
  case_id: caseId,
  revision: 1,
  state: "saved",
  evidence_kind: "customer_assertion",
  snapshot: { ...snapshot, revision: 1 },
  withheld_record_ids: [],
  snapshot_usable_for_save: true,
  external_actions: "unsupported",
  created_at: "2026-10-22T12:00:00Z",
};
const operations = [
  {
    action: "save_catalog_case",
    case_id: caseId,
    expected_revision: 0,
    idempotency_key: "save-1",
    snapshot,
  },
  { action: "read_catalog_case", case_id: caseId },
  { action: "list_catalog_cases" },
];
function http(body: unknown) {
  return contextOperationHandler(
    new NextRequest("http://localhost/api/context", { method: "POST", body: JSON.stringify(body) }),
  );
}
function mcp() {
  const registerTool = vi.fn();
  registerContextTool({ registerTool } as never);
  return registerTool.mock.calls[0][2];
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId: actor } as never);
  vi.mocked(resolveAccountId).mockResolvedValue({ accountId: actor, error: null });
  vi.mocked(authorizeContextOwner).mockResolvedValue({
    accountId: actor,
    ownerId: owner,
    organizationId: owner,
  });
  vi.mocked(callContextRpc).mockResolvedValue(receipt);
});
describe("catalog cases HTTP and standard MCP", () => {
  it.each(operations)("runs shared $action with private response caching", async operation => {
    const output =
      operation.action === "list_catalog_cases"
        ? { cases: [], next_id: null, has_more: false }
        : receipt;
    vi.mocked(callContextRpc).mockResolvedValue(output);
    const input = { ...operation, organization_id: owner };
    const response = await http(input);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(output);
    const calls = vi.mocked(callContextRpc).mock.calls.slice();
    vi.mocked(callContextRpc).mockClear();
    const result = await mcp()(input, {});
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual(output);
    expect(vi.mocked(callContextRpc).mock.calls).toEqual(calls);
  });
  it("requires authenticated account and rejects snapshot workspace overrides", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect((await http(operations[0])).status).toBe(401);
    expect(
      (await http({ ...operations[0], snapshot: { ...snapshot, workspace_id: actor } })).status,
    ).toBe(409);
    vi.mocked(resolveAccountId).mockResolvedValueOnce({ accountId: null, error: "Unauthorized" });
    expect((await mcp()(operations[0], {})).isError).toBe(true);
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it.each(operations)("does not leak private storage failure for $action", async operation => {
    vi.mocked(callContextRpc).mockRejectedValue(new Error("private-provider-source-name"));
    const response = await http({ ...operation, organization_id: owner });
    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("private-provider");
    expect(body.error).not.toContain("ingestion");
    if (operation.action === "save_catalog_case")
      expect(body.error).toContain("same idempotency key");
    else expect(body.error).not.toContain("idempotency");
  });
  it("rejects a direct delegated call before storage", async () => {
    const result = await mcp()(operations[0], { authInfo: { extra: { oauth: true } } });
    expect(result.isError).toBe(true);
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it("keeps all three operations out of delegated OAuth", () => {
    for (const operation of operations)
      expect(
        contextToolOperations[operation.action as keyof typeof contextToolOperations],
      ).toMatchObject({ delegated: false });
  });
  it("discovers and executes dedicated tools over the real MCP SDK", async () => {
    const server = new McpServer({ name: "catalog-case-test", version: "1" });
    registerContextTool(server);
    const client = new Client({ name: "test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const { tools } = await client.listTools();
      for (const [index, name] of [
        "save_catalog_case",
        "read_catalog_case",
        "list_catalog_cases",
      ].entries()) {
        const tool = tools.find(item => item.name === name);
        expect(tool).toBeDefined();
        expect(tool?.inputSchema.properties).not.toHaveProperty("action");
        expect(tool?.inputSchema.properties).not.toHaveProperty("account_id");
        const { action: _action, ...args } = operations[index];
        const output = index === 2 ? { cases: [], next_id: null, has_more: false } : receipt;
        vi.mocked(callContextRpc).mockResolvedValue(output);
        const result = await client.callTool({
          name,
          arguments: { ...args, organization_id: owner },
        });
        expect(result.isError).not.toBe(true);
        expect(JSON.parse((result.content as Array<{ text: string }>)[0].text)).toEqual(output);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });
});

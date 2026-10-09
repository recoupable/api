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
const version = "33333333-3333-4333-8333-333333333333";
const id = "44444444-4444-4444-8444-444444444444";
const targets = [{ artist_id: actor }];
const receipt = {
  id,
  owner_id: owner,
  actor_id: actor,
  source_version_id: version,
  created_at: "2026-10-09T17:00:00+00:00",
  targets,
  assertion: "relevance_only",
  rights_verified: false,
  policy_version: "private-evidence-association-v1",
};
const operations = [
  { action: "attach_evidence", source_version_id: version, targets, idempotency_key: "link-1" },
  { action: "read_evidence_attachment", attachment_id: id },
  { action: "list_evidence_attachments", source_version_id: version },
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
describe("evidence HTTP and standard Context MCP", () => {
  it.each(operations)("uses the real shared $action operation", async operation => {
    const output =
      operation.action === "list_evidence_attachments"
        ? { items: [receipt], next_id: null, has_more: false }
        : receipt;
    vi.mocked(callContextRpc).mockResolvedValue(output);
    const input = { ...operation, organization_id: owner };
    const response = await http(input);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(output);
    expect(validateAuthContext).toHaveBeenCalledWith(expect.any(NextRequest), {
      organizationId: owner,
    });
    const httpCalls = vi.mocked(callContextRpc).mock.calls.slice();
    vi.mocked(callContextRpc).mockClear();
    const result = await mcp()(input, {});
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual(output);
    expect(vi.mocked(callContextRpc).mock.calls).toEqual(httpCalls);
    expect(authorizeContextOwner).toHaveBeenCalledWith(actor, owner);
  });
  it("requires authentication before storage on both interfaces", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect((await http(operations[0])).status).toBe(401);
    vi.mocked(resolveAccountId).mockResolvedValueOnce({
      accountId: null,
      error: "Authentication required",
    });
    expect((await mcp()(operations[0], {})).isError).toBe(true);
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it("rejects identity overrides on both interfaces", async () => {
    const input = { ...operations[0], account_id: actor };
    expect((await http(input)).status).toBe(400);
    expect((await mcp()(input, {})).isError).toBe(true);
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it("withholds sensitive storage denial details", async () => {
    vi.mocked(callContextRpc).mockRejectedValue(new Error("Private provider/source/target detail"));
    const response = await http(operations[0]);
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain("Private provider");
    const result = await mcp()(operations[0], {});
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Private provider");
  });
  it("withholds cross-workspace receipts through both interfaces", async () => {
    vi.mocked(callContextRpc).mockResolvedValue({ ...receipt, owner_id: actor });
    const response = await http(operations[0]);
    expect(response.status).toBe(409);
    expect(await response.json()).not.toHaveProperty("targets");
    const result = await mcp()(operations[0], {});
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain(id);
  });
  it("rejects forged action and actor fields in direct dedicated-tool calls", async () => {
    const registerTool = vi.fn();
    registerContextTool({ registerTool } as never);
    const run = registerTool.mock.calls.find(call => call[0] === "attach_music_evidence")![2];
    const input = { source_version_id: version, targets, idempotency_key: "link-1" };
    for (const patch of [{ action: "ingest" }, { account_id: actor }, { owner_id: owner }])
      expect((await run({ ...input, ...patch }, {})).isError).toBe(true);
    expect(callContextRpc).not.toHaveBeenCalled();
  });
  it("discovers and executes the new operations over the real MCP SDK", async () => {
    const server = new McpServer({ name: "recoup-context-test", version: "1" });
    registerContextTool(server);
    const client = new Client({ name: "test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const { tools } = await client.listTools();
      for (const name of [
        "attach_music_evidence",
        "read_music_evidence_attachment",
        "list_music_evidence_attachments",
      ]) {
        const tool = tools.find(tool => tool.name === name)!;
        expect(tool).toBeDefined();
        expect(Object.keys(tool.inputSchema.properties ?? {}).length).toBeGreaterThan(0);
        expect(tool.inputSchema.properties).not.toHaveProperty("action");
        expect(tool.inputSchema.properties).not.toHaveProperty("account_id");
      }
      for (const [index, name] of [
        "attach_music_evidence",
        "read_music_evidence_attachment",
        "list_music_evidence_attachments",
      ].entries()) {
        const { action: _action, ...args } = operations[index];
        const output = index === 2 ? { items: [receipt], next_id: null, has_more: false } : receipt;
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

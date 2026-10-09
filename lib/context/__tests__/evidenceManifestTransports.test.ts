import { expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { contextOperationHandler } from "../contextOperationHandler";
import { registerEvidenceManifestTool } from "@/lib/mcp/tools/context/registerEvidenceManifestTool";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: vi.fn() }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(),
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: vi.fn(),
}));
const actor = "11111111-1111-4111-8111-111111111111";
const request = "22222222-2222-4222-8222-222222222222";
const page = { owner_id: actor, request_id: request, versions: [], has_more: false, next_id: null };
function setup() {
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId: actor } as never);
  vi.mocked(resolveAccountId).mockResolvedValue({ accountId: actor, error: null });
  vi.mocked(authorizeContextOwner).mockResolvedValue({
    accountId: actor,
    ownerId: actor,
    organizationId: null,
  });
  vi.mocked(callContextRpc).mockResolvedValue(page);
  const registerTool = vi.fn();
  registerEvidenceManifestTool({ registerTool } as never);
  return registerTool.mock.calls[0][2];
}
function http(input: unknown = { action: "list_evidence_versions", request_id: request }) {
  return contextOperationHandler(
    new NextRequest("http://localhost/api/context", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
it("HTTP and standard MCP return identical saved metadata through the real domain handler", async () => {
  const tool = setup();
  expect(await (await http()).json()).toEqual(page);
  const result = await tool({ request_id: request }, {});
  expect(JSON.parse(result.content[0].text)).toEqual(page);
  expect(callContextRpc).toHaveBeenLastCalledWith("list_context_request_evidence_versions", {
    p_actor: actor,
    p_owner: actor,
    p_request: request,
    p_after: null,
  });
});
it("both transports withhold malformed backend data", async () => {
  const tool = setup();
  vi.mocked(callContextRpc).mockResolvedValue({ ...page, private_content: "secret" });
  expect((await http()).status).toBe(409);
  const result = await tool({ request_id: request }, {});
  expect(result.isError).toBe(true);
  expect(result.content[0].text).not.toContain("secret");
});
it("both transports deny revoked owner authorization", async () => {
  const tool = setup();
  vi.mocked(authorizeContextOwner).mockRejectedValue(new Error("secret revoked member"));
  expect((await http()).status).toBe(409);
  const result = await tool({ request_id: request }, {});
  expect(result.isError).toBe(true);
  expect(result.content[0].text).not.toContain("secret");
});
it("both transports require authentication", async () => {
  const tool = setup();
  vi.mocked(validateAuthContext).mockResolvedValue(NextResponse.json({}, { status: 401 }));
  vi.mocked(resolveAccountId).mockResolvedValue({
    accountId: null,
    error: "Authentication required",
  });
  expect((await http()).status).toBe(401);
  const result = await tool({ request_id: request }, {});
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain("Recoup API key");
});
it("both transports reject actor overrides", async () => {
  const tool = setup();
  expect(
    (await http({ action: "list_evidence_versions", request_id: request, account_id: actor }))
      .status,
  ).toBe(400);
  expect((await tool({ request_id: request, account_id: actor }, {})).isError).toBe(true);
});
it("discovers and executes the concrete tool using the real MCP SDK", async () => {
  setup();
  const server = new McpServer({ name: "evidence-test", version: "1" });
  registerEvidenceManifestTool(server);
  const client = new Client({ name: "fixture", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    expect(tools[0].inputSchema.required).toEqual(["request_id"]);
    expect(tools[0].inputSchema.properties).toHaveProperty("after_id");
    expect(tools[0].inputSchema.properties).not.toHaveProperty("account_id");
    expect(tools[0].annotations?.readOnlyHint).toBe(true);
    const result = await client.callTool({
      name: "list_context_evidence_versions",
      arguments: { request_id: request },
    });
    expect(result.isError).not.toBe(true);
    expect(JSON.parse((result.content as { text: string }[])[0].text)).toEqual(page);
  } finally {
    await client.close();
    await server.close();
  }
});

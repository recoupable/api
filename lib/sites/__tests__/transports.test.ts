import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { siteOperationHandler } from "../siteOperationHandler";
import { registerAllSitesTools } from "@/lib/mcp/tools/sites";
import { SiteError } from "../SiteError";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
const m = vi.hoisted(() => ({ auth: vi.fn(), process: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: m.auth }));
vi.mock("../processSiteOperation", () => ({ processSiteOperation: m.process }));
vi.mock("../processSiteAsset", () => ({ processSiteAsset: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ accountId: id });
  m.process.mockResolvedValue({ site: { id } });
});
function tools() {
  const registry: Record<
    string,
    { config: Record<string, unknown>; run: (args: unknown, extra: unknown) => Promise<unknown> }
  > = {};
  registerAllSitesTools({
    registerTool: (
      name: string,
      config: Record<string, unknown>,
      run: (args: unknown, extra: unknown) => Promise<unknown>,
    ) => {
      registry[name] = { config, run };
    },
  } as unknown as McpServer);
  return registry;
}
it("HTTP rejects unauthenticated requests without calling domain logic", async () => {
  m.auth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  expect(
    (await siteOperationHandler(new NextRequest("https://api.test/api/sites"), "list", {})).status,
  ).toBe(401);
  expect(m.process).not.toHaveBeenCalled();
});
it.each(["x-api-key", "Authorization"])("uses standard auth with %s", async header => {
  const request = new NextRequest("https://api.test/api/sites", { headers: { [header]: "test" } });
  const result = await siteOperationHandler(request, "create", { name: "n", brief: "b" });
  expect(result.status).toBe(201);
  expect(m.auth).toHaveBeenCalledWith(request);
  expect(m.process).toHaveBeenCalledWith(id, "create", { name: "n", brief: "b" });
});
it("MCP registers all operations and fails closed without auth", async () => {
  const t = tools();
  expect(Object.keys(t)).toEqual(
    expect.arrayContaining([
      "list_sites",
      "get_site",
      "create_site",
      "generate_site",
      "publish_site",
      "unpublish_site",
      "get_site_signups",
      "upload_site_asset",
    ]),
  );
  expect(await t.create_site.run({ account_id: id }, {})).toMatchObject({ isError: true });
  expect(m.process).not.toHaveBeenCalled();
});
it("MCP and HTTP call the same generation operation and authenticated identity", async () => {
  const input = { id, revision: 1, instruction: "make a game" };
  await tools().generate_site.run(input, { authInfo: { extra: { accountId: id } } });
  await siteOperationHandler(new NextRequest("https://api.test/api/sites"), "generate", input);
  expect(m.process.mock.calls).toEqual([
    [id, "generate", input],
    [id, "generate", input],
  ]);
});
it("revision conflicts remain errors on both transports", async () => {
  m.process.mockRejectedValue(new SiteError(409, "Reload"));
  expect(
    (await siteOperationHandler(new NextRequest("https://api.test/api/sites"), "publish", {}))
      .status,
  ).toBe(409);
  expect(
    await tools().publish_site.run({}, { authInfo: { extra: { accountId: id } } }),
  ).toMatchObject({ isError: true });
});

it("exposes valid schemas through a real MCP client and rejects anonymous calls", async () => {
  const { McpServer: Server } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
  const server = new Server({ name: "sites-test", version: "1" });
  registerAllSitesTools(server);
  const client = new Client({ name: "test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(8);
    expect(result.tools.find(t => t.name === "create_site")?.inputSchema.properties).toHaveProperty(
      "releaseUrl",
    );
    const call = await client.callTool({ name: "list_sites", arguments: {} });
    expect(call.isError).toBe(true);
  } finally {
    await client.close();
    await server.close();
  }
});

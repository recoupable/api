import { expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerOAuthTools } from "../registerOAuthTools";
import { registerRecoupExtension } from "../../extension/registerRecoupExtension";

it("discovers all seven limited registrations without invoking business services", async () => {
  const services = {
    listArtists: vi.fn(),
    createArtist: vi.fn(),
    updateArtist: vi.fn(),
    getSocials: vi.fn(),
    getChats: vi.fn(),
  };
  const verify = vi.fn();
  const server = new McpServer({ name: "recoup-limited-test", version: "1" });
  registerOAuthTools(server, services, verify);
  registerRecoupExtension(server);
  const client = new Client({ name: "test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    const expected: Record<string, [boolean, boolean, boolean]> = {
      list_artists: [true, false, false],
      create_new_artist: [false, false, false],
      update_account_info: [false, true, false],
      get_artist_socials: [true, false, false],
      get_chats: [true, false, false],
      open_recoup_workflows: [true, false, false],
      open_recoup_workflows_sidebar: [true, false, false],
    };
    expect(tools.map(tool => tool.name).sort()).toEqual(Object.keys(expected).sort());
    expect(tools).toHaveLength(7);
    expect(tools.filter(tool => tool.name !== "open_recoup_workflows_sidebar")).toHaveLength(6);
    expect(
      tools.find(tool => tool.name === "open_recoup_workflows_sidebar")?._meta?.ui,
    ).toMatchObject({ visibility: ["app"] });
    for (const tool of tools) {
      const [readOnlyHint, destructiveHint, openWorldHint] = expected[tool.name];
      expect(tool.annotations).toMatchObject({ readOnlyHint, destructiveHint, openWorldHint });
      expect(tool.inputSchema.properties).not.toHaveProperty("account_id");
    }
    expect(verify).not.toHaveBeenCalled();
    for (const service of Object.values(services)) expect(service).not.toHaveBeenCalled();
  } finally {
    await client.close();
    await server.close();
  }
});

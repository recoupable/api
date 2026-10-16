import { expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { contextToolOperations } from "../contextToolOperations";
import { fullOAuthToolPolicy } from "../fullOAuthToolPolicy";
vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.hoisted(() => {
  process.env.PRIVY_PROJECT_SECRET = "test";
  process.env.SPOTIFY_CLIENT_ID = "test";
  process.env.SPOTIFY_CLIENT_SECRET = "test";
});
vi.mock("@/lib/arweave/client", () => ({ arweave: {}, ARWEAVE_KEY: {} }));
vi.mock("@/lib/telegram/client", () => ({ default: {} }));
vi.mock("@/lib/apify/client", () => ({ default: {}, apifyClient: {} }));
vi.mock("@/lib/privy/client", () => ({ default: {} }));
vi.mock("@/lib/emails/client", () => ({ default: {} }));
vi.mock("@/lib/stripe/client", () => ({ default: {} }));
it("discovers the entire delegated catalog over the real MCP SDK", async () => {
  const server = new McpServer({ name: "recoup-test", version: "1" });
  registerFullOAuthTools(server, vi.fn(), { prepare: vi.fn(), listArtists: vi.fn() });
  const client = new Client({ name: "test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name).sort()).toEqual(
      [
        ...Object.keys(fullOAuthToolPolicy).filter(
          name => !["get_pulses", "update_pulse"].includes(name),
        ),
        "get_daily_email_status",
        "set_daily_email_status",
        ...Object.values(contextToolOperations).map(operation => operation.name),
      ].sort(),
    );
    for (const tool of tools) expect(tool.inputSchema.properties).not.toHaveProperty("account_id");
    expect(tools).toHaveLength(86);
    for (const operation of Object.values(contextToolOperations)) {
      const tool = tools.find(tool => tool.name === operation.name)!;
      expect(Object.keys(tool.inputSchema.properties ?? {}).length).toBeGreaterThan(0);
      expect(tool.inputSchema.properties).not.toHaveProperty("action");
      expect(tool.annotations?.readOnlyHint).toBe(operation.readOnly);
    }
    const artist = tools.find(tool => tool.name === "create_new_artist")!;
    expect(artist.inputSchema.properties).not.toHaveProperty("active_conversation_id");
    expect(JSON.stringify(artist)).not.toMatch(/system prompt|copy.*conversation/i);
    expect(tools.map(tool => tool.name)).not.toContain("list_professional_roster");
    expect(tools.map(tool => tool.name)).not.toContain("confirm_professional_roster");
    expect(
      tools.find(tool => tool.name === "send_email")!.inputSchema.required ?? [],
    ).not.toContain("room_id");
  } finally {
    await client.close();
    await server.close();
  }
});

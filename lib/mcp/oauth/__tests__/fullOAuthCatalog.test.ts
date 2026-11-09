import { expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { contextToolOperations } from "../contextToolOperations";
import { fullOAuthToolPolicy } from "../fullOAuthToolPolicy";
import { registerRecoupExtension } from "../../extension/registerRecoupExtension";
vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.hoisted(() => {
  process.env.PRIVY_PROJECT_SECRET = "test";
  process.env.SPOTIFY_CLIENT_ID = "test";
  process.env.SPOTIFY_CLIENT_SECRET = "test";
});
vi.mock("@/lib/telegram/client", () => ({ default: {} }));
vi.mock("@/lib/apify/client", () => ({ default: {}, apifyClient: {} }));
vi.mock("@/lib/privy/client", () => ({ default: {} }));
vi.mock("@/lib/emails/client", () => ({ default: {} }));
vi.mock("@/lib/stripe/client", () => ({ default: {} }));
const standardOnlyContextActions = [
  "attach_evidence",
  "read_evidence_attachment",
  "list_evidence_attachments",
  "save_catalog_case",
  "read_catalog_case",
  "list_catalog_cases",
];
it("discovers the entire delegated catalog over the real MCP SDK", async () => {
  expect(
    Object.entries(contextToolOperations)
      .filter(([, operation]) => "delegated" in operation && operation.delegated === false)
      .map(([action]) => action)
      .sort(),
  ).toEqual([...standardOnlyContextActions].sort());
  const server = new McpServer({ name: "recoup-test", version: "1" });
  registerFullOAuthTools(server, vi.fn(), { prepare: vi.fn(), listArtists: vi.fn() });
  registerRecoupExtension(server);
  const client = new Client({ name: "test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name).sort()).toEqual(
      [
        ...Object.keys(fullOAuthToolPolicy).filter(
          name =>
            ![
              "get_pulses",
              "update_pulse",
              "artist_deep_research",
              "spotify_deep_research",
            ].includes(name),
        ),
        "open_recoup_workflows",
        "open_recoup_workflows_sidebar",
        "get_daily_email_status",
        "set_daily_email_status",
        ...Object.entries(contextToolOperations)
          .filter(([action]) => !standardOnlyContextActions.includes(action))
          .map(([, operation]) => operation.name),
      ].sort(),
    );
    for (const tool of tools) expect(tool.inputSchema.properties).not.toHaveProperty("account_id");
    expect(tools).toHaveLength(91);
    for (const tool of tools) {
      for (const hint of ["readOnlyHint", "destructiveHint", "openWorldHint"] as const)
        expect(typeof tool.annotations?.[hint], `${tool.name}.${hint}`).toBe("boolean");
    }
    const expectedAnnotations: Record<string, [boolean, boolean, boolean]> = {
      list_artists: [true, false, false],
      get_tasks: [true, false, false],
      get_youtube_revenue: [true, false, false],
      search_web: [true, false, true],
      send_email: [false, true, true],
      contact_team: [false, true, false],
      compact_chats: [true, false, false],
      generate_image: [false, true, true],
      edit_image: [false, true, true],
      analyze_music: [false, true, true],
      insert_catalog_songs: [false, true, true],
      read_music_context: [true, false, false],
      save_music_context_brief: [false, false, false],
      upload_site_asset: [false, true, true],
      generate_site: [false, true, true],
      get_site: [true, false, false],
      get_release_player: [true, false, false],
      get_release_pack: [false, true, false],
      export_release_pack: [false, true, false],
    };
    for (const [name, [readOnlyHint, destructiveHint, openWorldHint]] of Object.entries(
      expectedAnnotations,
    )) {
      expect(tools.find(tool => tool.name === name)?.annotations, name).toMatchObject({
        readOnlyHint,
        destructiveHint,
        openWorldHint,
      });
    }
    expect(tools.map(tool => tool.name)).toContain("get_artist_socials");
    expect(tools.map(tool => tool.name)).not.toContain("artist_deep_research");
    expect(tools.map(tool => tool.name)).not.toContain("spotify_deep_research");
    for (const [action, operation] of Object.entries(contextToolOperations)) {
      if (standardOnlyContextActions.includes(action)) {
        expect(tools.map(tool => tool.name)).not.toContain(operation.name);
        continue;
      }
      const tool = tools.find(tool => tool.name === operation.name)!;
      expect(Object.keys(tool.inputSchema.properties ?? {}).length).toBeGreaterThan(0);
      expect(tool.inputSchema.properties).not.toHaveProperty("action");
      expect(tool.annotations).toMatchObject({
        readOnlyHint: operation.readOnly,
        destructiveHint: operation.destructive,
        openWorldHint: operation.openWorld,
      });
    }
    const artist = tools.find(tool => tool.name === "create_new_artist")!;
    expect(artist.inputSchema.properties).not.toHaveProperty("active_conversation_id");
    expect(JSON.stringify(artist)).not.toMatch(/system prompt|copy.*conversation/i);
    expect(tools.map(tool => tool.name)).not.toContain("validate_application_registration");
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

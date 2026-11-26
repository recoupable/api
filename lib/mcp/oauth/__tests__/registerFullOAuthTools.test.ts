import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { registerGetArtistSocialsTool } from "../../tools/artistSocials/registerGetArtistSocialsTool";

const socials = vi.hoisted(() => {
  process.env.PRIVY_PROJECT_SECRET = "test";
  return vi.fn();
});
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/artist/getArtistSocials", () => ({ getArtistSocials: socials }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));

const operation = vi.fn(async (args: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(args) }],
}));
vi.mock("../../tools", () => ({
  registerAllTools: (server: McpServer) => {
    server.registerTool(
      "get_tasks",
      { inputSchema: z.object({ account_id: z.string().optional() }) },
      operation,
    );
    server.registerTool(
      "context",
      {
        inputSchema: z.discriminatedUnion("action", [
          z.strictObject({ action: z.literal("read"), request_id: z.string() }),
          z.strictObject({
            action: z.literal("save_brief"),
            request_id: z.string(),
            idempotency_key: z.string(),
          }),
        ]),
      },
      operation,
    );
    server.registerTool(
      "create_new_artist",
      {
        description: "Copy the active conversation using the system prompt.",
        inputSchema: z.object({
          name: z.string(),
          account_id: z.string().optional(),
          active_conversation_id: z.string().optional(),
          organization_id: z.string().optional(),
        }),
      },
      operation,
    );
    server.registerTool(
      "get_pulses",
      { inputSchema: z.object({ active: z.boolean().optional() }) },
      operation,
    );
    server.registerTool(
      "update_pulse",
      { inputSchema: z.object({ active: z.boolean() }) },
      operation,
    );
    registerGetArtistSocialsTool(server);
    for (const name of [
      "artist_deep_research",
      "spotify_deep_research",
      "get_catalog_playcount_history",
      "get_catalog_streams",
      "manage_catalog_stream_tracking",
      "ingestion",
    ]) {
      server.registerTool(name, { inputSchema: z.object({}) }, operation);
    }
    server.registerTool("get_api_key", { inputSchema: z.object({}) }, operation);
  },
}));
const access = {
  accountId: "owner",
  clientId: "client",
  grantId: "grant",
  scopes: ["mcp:tools"],
  expiresAt: 9999999999,
  resource: "https://api.recoupable.dev/mcp",
  context: "personal" as const,
};
const extra = {
  authInfo: {
    token: "secret",
    clientId: "client",
    scopes: access.scopes,
    extra: { accountId: "owner", oauth: access },
  },
};
function setup(current: unknown = access, mode?: "selected_context") {
  const registered = new Map<string, { config: any; run: any }>();
  const server = {
    registerTool: vi.fn((name, config, run) => registered.set(name, { config, run })),
  };
  const prepare = vi.fn(async (_name: string, args: Record<string, unknown>) => args);
  registerFullOAuthTools(
    server as unknown as McpServer,
    vi.fn().mockResolvedValue(current),
    {
      prepare,
      listArtists: vi.fn().mockResolvedValue([]),
    },
    mode,
  );
  return { registered, prepare };
}
describe("full OAuth registry", () => {
  it("includes business tools and artist discovery, never the credential-export tool", () => {
    const { registered } = setup();
    expect([...registered.keys()].sort()).toEqual(
      [
        "create_new_artist",
        "get_daily_email_status",
        "get_artist_socials",
        "get_tasks",
        "list_artists",
        "read_music_context",
        "save_music_context_brief",
        "set_daily_email_status",
      ].sort(),
    );
    expect(
      registered.get("get_tasks")!.config.inputSchema.safeParse({ account_id: "victim" }).success,
    ).toBe(false);
    expect(registered.has("artist_deep_research")).toBe(false);
    expect(registered.has("spotify_deep_research")).toBe(false);
    expect(registered.has("ingestion")).toBe(false);
  });
  it("reads artist socials through the real tool registration with OAuth-bound access", async () => {
    const { registered, prepare } = setup();
    const tool = registered.get("get_artist_socials")!;
    const artist_account_id = "artist-listed-for-owner";
    const profile = {
      status: "success",
      socials: [{ username: "saved-profile", follower_count: 42 }],
      pagination: { page: 1, limit: 20, total_count: 1, total_pages: 1 },
    };
    socials.mockResolvedValue(profile);

    const result = await tool.run({ artist_account_id }, extra);
    expect(result.isError).toBeFalsy();
    const expectedArgs = { artist_account_id, page: 1, limit: 20 };
    expect(prepare).toHaveBeenCalledExactlyOnceWith("get_artist_socials", expectedArgs, "owner");
    expect(socials).toHaveBeenCalledExactlyOnceWith(expectedArgs);
    expect(JSON.parse(result.content[0].text)).toEqual(profile);

    socials.mockClear();
    const custom = { artist_account_id, page: 2, limit: 5, history: 14 };
    expect((await tool.run(custom, extra)).isError).toBeFalsy();
    expect(socials).toHaveBeenCalledExactlyOnceWith(custom);

    socials.mockClear();
    prepare.mockRejectedValueOnce(new Error("Artist access denied"));
    expect((await tool.run({ artist_account_id: "outside-workspace" }, extra)).isError).toBe(true);
    expect(
      (await tool.run({ artist_account_id, account_id: "different-owner" }, extra)).isError,
    ).toBe(true);
    expect(socials).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    { ...access, scopes: ["mcp:read", "mcp:write"] },
    { ...access, accountId: "victim" },
    { ...access, clientId: "other" },
    { ...access, grantId: "other" },
  ])("rejects revoked, limited, and mismatched authority", async current => {
    const { registered, prepare } = setup(current === undefined ? null : current);
    expect((await registered.get("get_tasks")!.run({}, extra)).isError).toBe(true);
    expect(prepare).not.toHaveBeenCalled();
  });
  it("exposes operation schemas, binds their action, and preserves delegated checks", async () => {
    const { registered, prepare } = setup();
    const read = registered.get("read_music_context")!;
    expect(read.config.annotations.readOnlyHint).toBe(true);
    expect(registered.get("save_music_context_brief")!.config.annotations.readOnlyHint).toBe(false);
    expect(read.config.inputSchema.shape.request_id).toBeDefined();
    expect(read.config.inputSchema.shape.action).toBeUndefined();
    expect((await read.run({ request_id: "request", action: "save_brief" }, extra)).isError).toBe(
      true,
    );
    expect(prepare).not.toHaveBeenCalled();
    await read.run({ request_id: "request" }, extra);
    expect(prepare).toHaveBeenCalledWith(
      "context",
      { action: "read", request_id: "request" },
      "owner",
    );
    const revoked = setup(null);
    expect(
      (await revoked.registered.get("read_music_context")!.run({ request_id: "request" }, extra))
        .isError,
    ).toBe(true);
    expect(revoked.prepare).not.toHaveBeenCalled();
  });
  it("does not request or accept conversation copying during artist creation", async () => {
    const { registered, prepare } = setup();
    const artist = registered.get("create_new_artist")!;
    expect(artist.config.description).not.toMatch(/conversation|system prompt/i);
    expect(
      (await artist.run({ name: "Demo", active_conversation_id: "private" }, extra)).isError,
    ).toBe(true);
    expect(prepare).not.toHaveBeenCalled();
    await artist.run({ name: "Demo" }, extra);
    expect(prepare).toHaveBeenCalledWith(
      "create_new_artist",
      { name: "Demo", account_id: "owner" },
      "owner",
    );
  });
  it("routes descriptive email preference names to existing authorization policies", async () => {
    const { registered, prepare } = setup();
    await registered.get("set_daily_email_status")!.run({ active: false }, extra);
    expect(prepare).toHaveBeenCalledWith("update_pulse", { active: false }, "owner");
  });
  it("binds hidden account input to the current verified caller", async () => {
    const { registered, prepare } = setup();
    await registered.get("get_tasks")!.run({}, extra);
    expect(prepare).toHaveBeenCalledWith("get_tasks", { account_id: "owner" }, "owner");
  });
});

vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));

it("keeps selected Context discovery narrow and rejects direct non-Context calls", async () => {
  const selected = {
    ...access,
    selectedContext: {
      version: 1,
      capabilityVersion: "context-workspace-v1",
      mode: "selected_context",
      kind: "personal",
      ownerId: "11111111-1111-4111-8111-111111111111",
      organizationId: null,
    },
  };
  const narrow = setup(selected, "selected_context");
  expect([...narrow.registered.keys()].sort()).toEqual([
    "read_music_context",
    "save_music_context_brief",
  ]);
  const broad = setup(selected);
  expect((await broad.registered.get("get_tasks")!.run({}, extra)).isError).toBe(true);
  expect(broad.prepare).not.toHaveBeenCalled();
});

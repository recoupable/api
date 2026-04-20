import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getComposioTools } from "../getTools";

import { createToolRouterSessions } from "../createToolRouterSessions";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

vi.mock("../createToolRouterSessions", () => ({
  createToolRouterSessions: vi.fn(),
}));

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

const mockTool = (description = "Mock tool") => ({
  description,
  inputSchema: { type: "object" },
  execute: vi.fn(),
});

const META_TOOLS = [
  "COMPOSIO_MANAGE_CONNECTIONS",
  "COMPOSIO_SEARCH_TOOLS",
  "COMPOSIO_GET_TOOL_SCHEMAS",
  "COMPOSIO_MULTI_EXECUTE_TOOL",
];

function buildSession(toolNames: string[]) {
  const tools = Object.fromEntries(toolNames.map(name => [name, mockTool(name)]));
  return { tools: vi.fn().mockResolvedValue(tools) };
}

describe("getComposioTools", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, COMPOSIO_API_KEY: "test-api-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty object when COMPOSIO_API_KEY is missing", async () => {
    delete process.env.COMPOSIO_API_KEY;

    const result = await getComposioTools("account-123");

    expect(result).toEqual({});
    expect(createToolRouterSessions).not.toHaveBeenCalled();
  });

  it("exposes only the 4 meta-tools from the customer session", async () => {
    vi.mocked(createToolRouterSessions).mockResolvedValue({
      customer: buildSession([...META_TOOLS, "TIKTOK_GET_USER_STATS"]),
    });

    const result = await getComposioTools("account-123");

    for (const name of META_TOOLS) expect(result).toHaveProperty(name);
    // The customer session's non-meta tool should be hidden — the agent reaches it
    // via COMPOSIO_MULTI_EXECUTE_TOOL instead.
    expect(result).not.toHaveProperty("TIKTOK_GET_USER_STATS");
  });

  it("exposes explicit non-meta tools from the artist session and no artist meta-tools", async () => {
    vi.mocked(createToolRouterSessions).mockResolvedValue({
      customer: buildSession(META_TOOLS),
      artist: buildSession([...META_TOOLS, "TIKTOK_GET_USER_STATS", "INSTAGRAM_LIST_MEDIA"]),
    });

    const result = await getComposioTools("account-123");

    expect(result).toHaveProperty("TIKTOK_GET_USER_STATS");
    expect(result).toHaveProperty("INSTAGRAM_LIST_MEDIA");
    // Meta-tools appear exactly once — from the customer session, not duplicated by artist
    const manageCount = Object.keys(result).filter(k => k === "COMPOSIO_MANAGE_CONNECTIONS").length;
    expect(manageCount).toBe(1);
  });

  it("exposes explicit non-meta tools from the shared session", async () => {
    vi.mocked(createToolRouterSessions).mockResolvedValue({
      customer: buildSession(META_TOOLS),
      shared: buildSession([...META_TOOLS, "GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT"]),
    });

    const result = await getComposioTools("account-123");

    expect(result).toHaveProperty("GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT");
  });

  it("merges tools from all three sessions", async () => {
    vi.mocked(createToolRouterSessions).mockResolvedValue({
      customer: buildSession(META_TOOLS),
      artist: buildSession(["TIKTOK_GET_USER_STATS"]),
      shared: buildSession(["GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT"]),
    });

    const result = await getComposioTools("account-123");

    expect(result).toHaveProperty("COMPOSIO_SEARCH_TOOLS");
    expect(result).toHaveProperty("TIKTOK_GET_USER_STATS");
    expect(result).toHaveProperty("GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT");
  });

  it("passes artistId into the session orchestrator only when access is granted", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(createToolRouterSessions).mockResolvedValue({
      customer: buildSession(META_TOOLS),
    });

    await getComposioTools("account-123", "artist-456", "room-789");

    expect(checkAccountArtistAccess).toHaveBeenCalledWith("account-123", "artist-456");
    expect(createToolRouterSessions).toHaveBeenCalledWith({
      customerAccountId: "account-123",
      artistId: "artist-456",
      roomId: "room-789",
    });
  });

  it("omits artistId when access is denied", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    vi.mocked(createToolRouterSessions).mockResolvedValue({
      customer: buildSession(META_TOOLS),
    });

    await getComposioTools("account-123", "artist-456", "room-789");

    expect(createToolRouterSessions).toHaveBeenCalledWith({
      customerAccountId: "account-123",
      artistId: undefined,
      roomId: "room-789",
    });
  });

  it("returns empty object and logs when session creation throws", async () => {
    vi.mocked(createToolRouterSessions).mockRejectedValue(new Error("boom"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getComposioTools("account-123");

    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledWith("Composio tools unavailable:", "boom");
    warn.mockRestore();
  });

  it("skips tools that lack required Vercel AI SDK shape", async () => {
    vi.mocked(createToolRouterSessions).mockResolvedValue({
      customer: {
        tools: vi.fn().mockResolvedValue({
          COMPOSIO_MANAGE_CONNECTIONS: mockTool(),
          COMPOSIO_SEARCH_TOOLS: { description: "missing execute" },
        }),
      },
    });

    const result = await getComposioTools("account-123");

    expect(result).toHaveProperty("COMPOSIO_MANAGE_CONNECTIONS");
    expect(result).not.toHaveProperty("COMPOSIO_SEARCH_TOOLS");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getComposioTools } from "../getTools";

import { createToolRouterSession } from "../createToolRouterSession";
import { getArtistConnectionsFromComposio } from "../getArtistConnectionsFromComposio";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";

// Mock dependencies
vi.mock("../createToolRouterSession", () => ({
  createToolRouterSession: vi.fn(),
}));

vi.mock("../getArtistConnectionsFromComposio", () => ({
  getArtistConnectionsFromComposio: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

// Mock valid tool structure
const createMockTool = () => ({
  description: "Test tool",
  inputSchema: { type: "object" },
  execute: vi.fn(),
});

describe("getComposioTools", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, COMPOSIO_API_KEY: "test-api-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return empty object when COMPOSIO_API_KEY is not set", async () => {
    delete process.env.COMPOSIO_API_KEY;

    const result = await getComposioTools("account-123");

    expect(result).toEqual({});
    expect(createToolRouterSession).not.toHaveBeenCalled();
  });

  it("should not fetch artist connections when artistId is not provided", async () => {
    const mockSession = {
      tools: vi.fn().mockResolvedValue({
        COMPOSIO_MANAGE_CONNECTIONS: createMockTool(),
      }),
    };
    vi.mocked(createToolRouterSession).mockResolvedValue(mockSession);

    await getComposioTools("account-123");

    expect(getArtistConnectionsFromComposio).not.toHaveBeenCalled();
    expect(createToolRouterSession).toHaveBeenCalledWith("account-123", undefined, undefined);
  });

  it("should fetch and pass artist connections when artistId is provided and access is granted", async () => {
    const mockConnections = { tiktok: "tiktok-account-456" };
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(getArtistConnectionsFromComposio).mockResolvedValue(mockConnections);

    const mockSession = {
      tools: vi.fn().mockResolvedValue({
        COMPOSIO_MANAGE_CONNECTIONS: createMockTool(),
      }),
    };
    vi.mocked(createToolRouterSession).mockResolvedValue(mockSession);

    await getComposioTools("account-123", "artist-456", "room-789");

    expect(checkAccountArtistAccess).toHaveBeenCalledWith("account-123", "artist-456");
    expect(getArtistConnectionsFromComposio).toHaveBeenCalledWith("artist-456");
    expect(createToolRouterSession).toHaveBeenCalledWith("account-123", "room-789", mockConnections);
  });

  it("should skip artist connections when access is denied", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const mockSession = {
      tools: vi.fn().mockResolvedValue({
        COMPOSIO_MANAGE_CONNECTIONS: createMockTool(),
      }),
    };
    vi.mocked(createToolRouterSession).mockResolvedValue(mockSession);

    await getComposioTools("account-123", "artist-456", "room-789");

    expect(checkAccountArtistAccess).toHaveBeenCalledWith("account-123", "artist-456");
    expect(getArtistConnectionsFromComposio).not.toHaveBeenCalled();
    expect(createToolRouterSession).toHaveBeenCalledWith("account-123", "room-789", undefined);
  });

  it("should pass undefined when artist has no connections", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(getArtistConnectionsFromComposio).mockResolvedValue({});

    const mockSession = {
      tools: vi.fn().mockResolvedValue({
        COMPOSIO_MANAGE_CONNECTIONS: createMockTool(),
      }),
    };
    vi.mocked(createToolRouterSession).mockResolvedValue(mockSession);

    await getComposioTools("account-123", "artist-no-connections");

    expect(getArtistConnectionsFromComposio).toHaveBeenCalledWith("artist-no-connections");
    expect(createToolRouterSession).toHaveBeenCalledWith("account-123", undefined, undefined);
  });

  it("should filter tools to only ALLOWED_TOOLS", async () => {
    const mockSession = {
      tools: vi.fn().mockResolvedValue({
        COMPOSIO_MANAGE_CONNECTIONS: createMockTool(),
        COMPOSIO_SEARCH_TOOLS: createMockTool(),
        SOME_OTHER_TOOL: createMockTool(),
      }),
    };
    vi.mocked(createToolRouterSession).mockResolvedValue(mockSession);

    const result = await getComposioTools("account-123");

    expect(result).toHaveProperty("COMPOSIO_MANAGE_CONNECTIONS");
    expect(result).toHaveProperty("COMPOSIO_SEARCH_TOOLS");
    expect(result).not.toHaveProperty("SOME_OTHER_TOOL");
  });

  it("should return empty object when session creation throws", async () => {
    vi.mocked(createToolRouterSession).mockRejectedValue(new Error("Bundler incompatibility"));

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getComposioTools("account-123");

    expect(result).toEqual({});
    expect(consoleSpy).toHaveBeenCalledWith(
      "Composio tools unavailable:",
      "Bundler incompatibility",
    );

    consoleSpy.mockRestore();
  });

  it("should skip invalid tools that lack required properties", async () => {
    const mockSession = {
      tools: vi.fn().mockResolvedValue({
        COMPOSIO_MANAGE_CONNECTIONS: createMockTool(),
        COMPOSIO_SEARCH_TOOLS: { description: "No execute function" },
      }),
    };
    vi.mocked(createToolRouterSession).mockResolvedValue(mockSession);

    const result = await getComposioTools("account-123");

    expect(result).toHaveProperty("COMPOSIO_MANAGE_CONNECTIONS");
    expect(result).not.toHaveProperty("COMPOSIO_SEARCH_TOOLS");
  });
});

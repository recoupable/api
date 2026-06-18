import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getComposioTools, ENABLED_TOOLKITS } from "../getComposioTools";

import { getComposioClient } from "../../client";
import { getCallbackUrl } from "../../getCallbackUrl";
import { getConnectors } from "../../connectors/getConnectors";
import { getSharedAccountConnections } from "../getSharedAccountConnections";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

vi.mock("../../client", () => ({ getComposioClient: vi.fn() }));
vi.mock("../../getCallbackUrl", () => ({ getCallbackUrl: vi.fn() }));
vi.mock("../../connectors/getConnectors", () => ({ getConnectors: vi.fn() }));
vi.mock("../getSharedAccountConnections", () => ({
  getSharedAccountConnections: vi.fn(),
}));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

const mockTool = (name = "mock") => ({
  description: name,
  inputSchema: { type: "object" },
  execute: vi.fn(),
});

const META_TOOLS = {
  COMPOSIO_MANAGE_CONNECTIONS: mockTool("manage"),
  COMPOSIO_SEARCH_TOOLS: mockTool("search"),
  COMPOSIO_GET_TOOL_SCHEMAS: mockTool("schemas"),
  COMPOSIO_MULTI_EXECUTE_TOOL: mockTool("execute"),
};

const SHARED_ACCOUNT_ID = "recoup-shared-767f498e-e1e9-43c6-a152-a96ae3bd8d07";

describe("getComposioTools", () => {
  const originalEnv = process.env;

  const mockCustomerSession = { tools: vi.fn() };
  const mockToolsGet = vi.fn();
  const mockCreate = vi.fn();
  const mockComposio = { create: mockCreate, tools: { get: mockToolsGet } };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, COMPOSIO_API_KEY: "test-api-key" };
    vi.mocked(getComposioClient).mockResolvedValue(mockComposio);
    vi.mocked(getCallbackUrl).mockReturnValue("https://example.com/chat?connected=true");
    vi.mocked(getConnectors).mockResolvedValue([]);
    vi.mocked(getSharedAccountConnections).mockResolvedValue({});
    mockCreate.mockResolvedValue(mockCustomerSession);
    mockCustomerSession.tools.mockResolvedValue({ ...META_TOOLS });
    mockToolsGet.mockResolvedValue({});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty object when COMPOSIO_API_KEY is missing", async () => {
    delete process.env.COMPOSIO_API_KEY;

    const result = await getComposioTools("account-123");

    expect(result).toEqual({});
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("exposes meta-tools from the customer session", async () => {
    const result = await getComposioTools("account-123");

    expect(result).toHaveProperty("COMPOSIO_MANAGE_CONNECTIONS");
    expect(result).toHaveProperty("COMPOSIO_SEARCH_TOOLS");
    expect(result).toHaveProperty("COMPOSIO_GET_TOOL_SCHEMAS");
    expect(result).toHaveProperty("COMPOSIO_MULTI_EXECUTE_TOOL");
  });

  it("fetches customer's own real tools via composio.tools.get", async () => {
    vi.mocked(getConnectors).mockImplementation(async (id: string) =>
      id === "account-123"
        ? [{ slug: "youtube", name: "YouTube", isConnected: true, connectedAccountId: "ca_yt" }]
        : [],
    );
    mockToolsGet.mockImplementation(async (owner: string) =>
      owner === "account-123" ? { YOUTUBE_GET_CHANNEL_STATISTICS: mockTool() } : {},
    );

    const result = await getComposioTools("account-123");

    expect(mockToolsGet).toHaveBeenCalledWith(
      "account-123",
      expect.objectContaining({ toolkits: ["youtube"] }),
    );
    expect(result).toHaveProperty("YOUTUBE_GET_CHANNEL_STATISTICS");
  });

  it("fetches artist's real tools when artistId is in scope", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(getConnectors).mockImplementation(async (id: string) =>
      id === "artist-456"
        ? [{ slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt" }]
        : [],
    );
    mockToolsGet.mockImplementation(async (owner: string) =>
      owner === "artist-456" ? { TIKTOK_GET_USER_STATS: mockTool() } : {},
    );

    const result = await getComposioTools("account-123", "artist-456");

    expect(mockToolsGet).toHaveBeenCalledWith(
      "artist-456",
      expect.objectContaining({ toolkits: ["tiktok"] }),
    );
    expect(result).toHaveProperty("TIKTOK_GET_USER_STATS");
  });

  it("fetches shared tools for the shared account's connected toolkits", async () => {
    vi.mocked(getSharedAccountConnections).mockResolvedValue({ googledocs: "ca_docs" });
    mockToolsGet.mockImplementation(async (owner: string) =>
      owner === SHARED_ACCOUNT_ID ? { GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT: mockTool() } : {},
    );

    const result = await getComposioTools("account-123");

    expect(mockToolsGet).toHaveBeenCalledWith(
      SHARED_ACCOUNT_ID,
      expect.objectContaining({ toolkits: ["googledocs"] }),
    );
    expect(result).toHaveProperty("GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT");
  });

  it("artist tools win over customer's on toolkit overlap", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(getConnectors).mockImplementation(async (id: string) => {
      const tiktok = {
        slug: "tiktok",
        name: "TikTok",
        isConnected: true,
        connectedAccountId: id === "artist-456" ? "ca_artist" : "ca_customer",
      };
      return [tiktok];
    });
    const artistTool = mockTool("artist-tiktok");
    const customerTool = mockTool("customer-tiktok");
    mockToolsGet.mockImplementation(async (owner: string) => {
      if (owner === "artist-456") return { TIKTOK_GET_USER_STATS: artistTool };
      if (owner === "account-123") return { TIKTOK_GET_USER_STATS: customerTool };
      return {};
    });

    const result = await getComposioTools("account-123", "artist-456");

    expect(result.TIKTOK_GET_USER_STATS).toBe(artistTool);
  });

  it("customer tools win over shared on toolkit overlap", async () => {
    vi.mocked(getConnectors).mockImplementation(async (id: string) =>
      id === "account-123"
        ? [
            {
              slug: "googledocs",
              name: "Google Docs",
              isConnected: true,
              connectedAccountId: "ca_my_docs",
            },
          ]
        : [],
    );
    vi.mocked(getSharedAccountConnections).mockResolvedValue({ googledocs: "ca_shared_docs" });
    const customerDocs = mockTool("customer-docs");
    const sharedDocs = mockTool("shared-docs");
    mockToolsGet.mockImplementation(async (owner: string) => {
      if (owner === "account-123") return { GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT: customerDocs };
      if (owner === SHARED_ACCOUNT_ID) return { GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT: sharedDocs };
      return {};
    });

    const result = await getComposioTools("account-123");

    expect(result.GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT).toBe(customerDocs);
  });

  it("does not fetch artist tools when access is denied", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    vi.mocked(getConnectors).mockImplementation(async (id: string) =>
      id === "artist-456"
        ? [{ slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt" }]
        : [],
    );

    await getComposioTools("account-123", "artist-456");

    expect(checkAccountArtistAccess).toHaveBeenCalledWith("account-123", "artist-456");
    const artistCalls = mockToolsGet.mock.calls.filter(([id]) => id === "artist-456");
    expect(artistCalls).toHaveLength(0);
  });

  it("returns empty object and logs when session creation throws", async () => {
    mockCreate.mockRejectedValue(new Error("bundler incompatibility"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getComposioTools("account-123");

    expect(result).toEqual({});
    expect(warn).toHaveBeenCalledWith("Composio tools unavailable:", "bundler incompatibility");
    warn.mockRestore();
  });

  it("skips invalid tools that lack required Vercel AI SDK shape", async () => {
    mockCustomerSession.tools.mockResolvedValue({
      COMPOSIO_MANAGE_CONNECTIONS: mockTool(),
      COMPOSIO_SEARCH_TOOLS: { description: "missing execute" },
    });

    const result = await getComposioTools("account-123");

    expect(result).toHaveProperty("COMPOSIO_MANAGE_CONNECTIONS");
    expect(result).not.toHaveProperty("COMPOSIO_SEARCH_TOOLS");
  });

  it("still returns meta-tools when an owner fetch rejects", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(getConnectors).mockImplementation(async (id: string) =>
      id === "artist-456"
        ? [{ slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt" }]
        : [],
    );
    mockToolsGet.mockImplementation(async (owner: string) => {
      if (owner === "artist-456") throw new Error("artist fetch failed");
      return {};
    });

    const result = await getComposioTools("account-123", "artist-456");

    expect(result).toHaveProperty("COMPOSIO_SEARCH_TOOLS");
    expect(result).toHaveProperty("COMPOSIO_MULTI_EXECUTE_TOOL");
  });
});

describe("ENABLED_TOOLKITS", () => {
  it("includes twitter and linkedin", () => {
    expect(ENABLED_TOOLKITS).toContain("twitter");
    expect(ENABLED_TOOLKITS).toContain("linkedin");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getComposioTools } from "../getTools";

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

  it("exposes only the 4 meta-tools from the customer session", async () => {
    mockCustomerSession.tools.mockResolvedValue({
      ...META_TOOLS,
      SOME_OTHER: mockTool(),
    });

    const result = await getComposioTools("account-123");

    expect(result).toHaveProperty("COMPOSIO_MANAGE_CONNECTIONS");
    expect(result).toHaveProperty("COMPOSIO_SEARCH_TOOLS");
    expect(result).toHaveProperty("COMPOSIO_GET_TOOL_SCHEMAS");
    expect(result).toHaveProperty("COMPOSIO_MULTI_EXECUTE_TOOL");
    expect(result).not.toHaveProperty("SOME_OTHER");
  });

  it("fetches explicit artist tools via composio.tools.get when artist has toolkits", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(getConnectors).mockImplementation(async (id: string) => {
      if (id === "artist-456") {
        return [{ slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt" }];
      }
      return [];
    });
    mockToolsGet.mockResolvedValue({ TIKTOK_GET_USER_STATS: mockTool("tiktok-stats") });

    const result = await getComposioTools("account-123", "artist-456", "room-789");

    expect(mockToolsGet).toHaveBeenCalledWith(
      "artist-456",
      expect.objectContaining({ toolkits: ["tiktok"] }),
    );
    expect(result).toHaveProperty("TIKTOK_GET_USER_STATS");
  });

  it("fetches explicit shared tools via composio.tools.get when shared has toolkits", async () => {
    vi.mocked(getSharedAccountConnections).mockResolvedValue({ googledocs: "ca_docs" });
    mockToolsGet.mockResolvedValue({
      GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT: mockTool("docs-plaintext"),
    });

    const result = await getComposioTools("account-123");

    expect(mockToolsGet).toHaveBeenCalledWith(
      SHARED_ACCOUNT_ID,
      expect.objectContaining({ toolkits: ["googledocs"] }),
    );
    expect(result).toHaveProperty("GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT");
  });

  it("skips artist tool fetch when the customer already covers the same toolkits", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(getConnectors).mockImplementation(async (id: string) => {
      const tiktok = {
        slug: "tiktok",
        name: "TikTok",
        isConnected: true,
        connectedAccountId: "ca_tt",
      };
      if (id === "artist-456") return [tiktok];
      if (id === "account-123") return [tiktok];
      return [];
    });

    await getComposioTools("account-123", "artist-456");

    const artistCalls = mockToolsGet.mock.calls.filter(([id]) => id === "artist-456");
    expect(artistCalls).toHaveLength(0);
  });

  it("skips shared tool fetch when customer already covers the Google toolkits", async () => {
    vi.mocked(getConnectors).mockImplementation(async (id: string) => {
      if (id === "account-123") {
        return [
          {
            slug: "googledocs",
            name: "Google Docs",
            isConnected: true,
            connectedAccountId: "ca_my_docs",
          },
        ];
      }
      return [];
    });
    vi.mocked(getSharedAccountConnections).mockResolvedValue({
      googledocs: "ca_shared_docs",
    });

    await getComposioTools("account-123");

    const sharedCalls = mockToolsGet.mock.calls.filter(([id]) => id === SHARED_ACCOUNT_ID);
    expect(sharedCalls).toHaveLength(0);
  });

  it("omits artistId when access is denied", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    vi.mocked(getConnectors).mockImplementation(async (id: string) => {
      if (id === "artist-456") {
        return [{ slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt" }];
      }
      return [];
    });

    await getComposioTools("account-123", "artist-456");

    expect(checkAccountArtistAccess).toHaveBeenCalledWith("account-123", "artist-456");
    const artistCalls = mockToolsGet.mock.calls.filter(([id]) => id === "artist-456");
    expect(artistCalls).toHaveLength(0);
  });

  it("merges customer meta-tools, artist tools, and shared tools into a single ToolSet", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    vi.mocked(getConnectors).mockImplementation(async (id: string) => {
      if (id === "artist-456") {
        return [{ slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt" }];
      }
      return [];
    });
    vi.mocked(getSharedAccountConnections).mockResolvedValue({ googledocs: "ca_shared_docs" });
    mockToolsGet.mockImplementation(async (owner: string) => {
      if (owner === "artist-456") return { TIKTOK_GET_USER_STATS: mockTool() };
      if (owner === SHARED_ACCOUNT_ID) return { GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT: mockTool() };
      return {};
    });

    const result = await getComposioTools("account-123", "artist-456");

    expect(result).toHaveProperty("COMPOSIO_SEARCH_TOOLS");
    expect(result).toHaveProperty("TIKTOK_GET_USER_STATS");
    expect(result).toHaveProperty("GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT");
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
});

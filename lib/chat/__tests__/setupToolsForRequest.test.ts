import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatRequestBody } from "../validateChatRequest";

// Mock external dependencies
vi.mock("@/lib/mcp/getMcpTools", () => ({
  getMcpTools: vi.fn(),
}));

vi.mock("@/lib/composio/toolRouter", () => ({
  getComposioTools: vi.fn(),
}));

// Import after mocks
import { setupToolsForRequest } from "../setupToolsForRequest";
import { getMcpTools } from "@/lib/mcp/getMcpTools";
import { getComposioTools } from "@/lib/composio/toolRouter";

const mockGetMcpTools = vi.mocked(getMcpTools);
const mockGetComposioTools = vi.mocked(getComposioTools);

describe("setupToolsForRequest", () => {
  const mockMcpTools = {
    tool1: { description: "Tool 1", parameters: {} },
    tool2: { description: "Tool 2", parameters: {} },
  };

  const mockComposioTools = {
    COMPOSIO_MANAGE_CONNECTIONS: { description: "Manage connections", parameters: {} },
    googlesheets_create: { description: "Create sheet", parameters: {} },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for MCP tools
    mockGetMcpTools.mockResolvedValue(mockMcpTools);

    // Default mock for Composio tools
    mockGetComposioTools.mockResolvedValue(mockComposioTools);
  });

  describe("MCP tools integration", () => {
    it("calls getMcpTools with authToken", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await setupToolsForRequest(body);

      expect(mockGetMcpTools).toHaveBeenCalledWith("test-token-123");
    });

    it("fetches tools from MCP client", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupToolsForRequest(body);

      expect(result).toHaveProperty("tool1");
      expect(result).toHaveProperty("tool2");
    });

    it("skips MCP tools when authToken is not provided", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await setupToolsForRequest(body);

      expect(mockGetMcpTools).not.toHaveBeenCalled();
    });
  });

  describe("Composio tools integration", () => {
    it("calls getComposioTools with accountId, artistId, and roomId", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        artistId: "artist-789",
        roomId: "room-456",
        messages: [{ id: "1", role: "user", content: "Create a spreadsheet" }],
      };

      await setupToolsForRequest(body);

      expect(mockGetComposioTools).toHaveBeenCalledWith("account-123", "artist-789", "room-456");
    });

    it("passes undefined artistId when not provided", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        roomId: "room-456",
        messages: [{ id: "1", role: "user", content: "Create a spreadsheet" }],
      };

      await setupToolsForRequest(body);

      expect(mockGetComposioTools).toHaveBeenCalledWith("account-123", undefined, "room-456");
    });

    it("includes Composio tools in result", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Create a spreadsheet" }],
      };

      const result = await setupToolsForRequest(body);

      expect(result).toHaveProperty("COMPOSIO_MANAGE_CONNECTIONS");
      expect(result).toHaveProperty("googlesheets_create");
    });
  });

  describe("tool aggregation", () => {
    it("merges MCP tools and Composio tools", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupToolsForRequest(body);

      // Should have both MCP and Composio tools
      expect(result).toHaveProperty("tool1");
      expect(result).toHaveProperty("tool2");
      expect(result).toHaveProperty("COMPOSIO_MANAGE_CONNECTIONS");
      expect(result).toHaveProperty("googlesheets_create");
    });

    it("Composio tools take precedence over MCP tools with same name", async () => {
      mockGetMcpTools.mockResolvedValue({
        googlesheets_create: { description: "MCP version", parameters: {} },
      });

      mockGetComposioTools.mockResolvedValue({
        googlesheets_create: { description: "Composio version", parameters: {} },
      });

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupToolsForRequest(body);

      // Composio version should win
      expect(result.googlesheets_create).toEqual(
        expect.objectContaining({ description: "Composio version" }),
      );
    });
  });

  describe("tool filtering", () => {
    it("excludes tools specified in excludeTools array", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
        excludeTools: ["tool1"],
      };

      const result = await setupToolsForRequest(body);

      expect(result).not.toHaveProperty("tool1");
      expect(result).toHaveProperty("tool2");
    });

    it("excludes multiple tools", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
        excludeTools: ["tool1", "googlesheets_create"],
      };

      const result = await setupToolsForRequest(body);

      expect(result).not.toHaveProperty("tool1");
      expect(result).not.toHaveProperty("googlesheets_create");
      expect(result).toHaveProperty("tool2");
      expect(result).toHaveProperty("COMPOSIO_MANAGE_CONNECTIONS");
    });

    it("returns all tools when excludeTools is undefined", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      const result = await setupToolsForRequest(body);

      expect(result).toHaveProperty("tool1");
      expect(result).toHaveProperty("tool2");
    });

    it("returns all tools when excludeTools is empty array", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
        excludeTools: [],
      };

      const result = await setupToolsForRequest(body);

      expect(result).toHaveProperty("tool1");
      expect(result).toHaveProperty("tool2");
    });
  });

  describe("parallel execution", () => {
    it("fetches MCP tools and Composio tools in parallel", async () => {
      const executionOrder: string[] = [];

      // Track when each operation starts and completes
      mockGetMcpTools.mockImplementation(async () => {
        executionOrder.push("getMcpTools:start");
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push("getMcpTools:end");
        return { mcpTool: { description: "MCP Tool", parameters: {} } };
      });

      mockGetComposioTools.mockImplementation(async () => {
        executionOrder.push("getComposioTools:start");
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push("getComposioTools:end");
        return { composioTool: { description: "Composio Tool", parameters: {} } };
      });

      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await setupToolsForRequest(body);

      // Both should start before either ends (parallel execution)
      const mcpStartIndex = executionOrder.indexOf("getMcpTools:start");
      const composioStartIndex = executionOrder.indexOf("getComposioTools:start");
      const mcpEndIndex = executionOrder.indexOf("getMcpTools:end");
      const composioEndIndex = executionOrder.indexOf("getComposioTools:end");

      // Both operations should have started
      expect(mcpStartIndex).toBeGreaterThanOrEqual(0);
      expect(composioStartIndex).toBeGreaterThanOrEqual(0);

      // Both starts should come before both ends
      expect(mcpStartIndex).toBeLessThan(mcpEndIndex);
      expect(composioStartIndex).toBeLessThan(composioEndIndex);

      // At least one start should come before the other's end (proves parallelism)
      const bothStartedBeforeAnyEnds =
        Math.max(mcpStartIndex, composioStartIndex) < Math.min(mcpEndIndex, composioEndIndex);
      expect(bothStartedBeforeAnyEnds).toBe(true);
    });

    it("both operations are called when authToken is provided", async () => {
      const body: ChatRequestBody = {
        accountId: "account-123",
        orgId: null,
        authToken: "test-token-123",
        messages: [{ id: "1", role: "user", content: "Hello" }],
      };

      await setupToolsForRequest(body);

      expect(mockGetMcpTools).toHaveBeenCalledTimes(1);
      expect(mockGetComposioTools).toHaveBeenCalledTimes(1);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateKnowledgeBaseTool } from "../registerCreateKnowledgeBaseTool";

vi.mock("@/lib/artist/createKnowledgeBase", () => ({
  createKnowledgeBase: vi.fn(),
}));

describe("registerCreateKnowledgeBaseTool", () => {
  let mockServer: McpServer;
  let registeredDescription: string;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      registerTool: vi.fn((_, config) => {
        registeredDescription = config.description as string;
      }),
    } as unknown as McpServer;

    registerCreateKnowledgeBaseTool(mockServer);
  });

  it("registers the tool with the correct name", () => {
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "create_knowledge_base",
      expect.any(Object),
      expect.any(Function),
    );
  });

  describe("description", () => {
    it("scopes usage to general reference notes and bios", () => {
      expect(registeredDescription).toContain(
        "general reference notes, bios, or background context",
      );
    });

    it("explicitly excludes releases from its scope", () => {
      expect(registeredDescription).toContain("NOT for releases, tracks, marketing plans");
    });

    it("redirects structured data to prompt_sandbox", () => {
      expect(registeredDescription).toContain("use prompt_sandbox for those");
    });

    it("does not mention adding knowledge base files", () => {
      expect(registeredDescription).not.toContain("Adds a knowledge base file");
    });
  });
});

import { expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";

vi.mock("../../tools", async () => {
  const { registerGenerateTxtFileTool } = await import(
    "../../tools/files/registerGenerateTxtFileTool"
  );
  const { registerCreateKnowledgeBaseTool } = await import(
    "../../tools/files/registerCreateKnowledgeBaseTool"
  );
  return {
    registerAllTools(server: McpServer) {
      registerGenerateTxtFileTool(server);
      registerCreateKnowledgeBaseTool(server);
    },
  };
});
vi.mock("@/lib/files/generateAndStoreTxtFile", () => ({ generateAndStoreTxtFile: vi.fn() }));
vi.mock("@/lib/artist/createKnowledgeBase", () => ({ createKnowledgeBase: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));

it.each(["generate_txt_file", "create_knowledge_base"])(
  "%s describes public storage without claiming permanent Arweave publication",
  name => {
    const registerTool = vi.fn();
    registerFullOAuthTools({ registerTool } as unknown as McpServer, vi.fn(), {
      prepare: vi.fn(),
      listArtists: vi.fn(),
    });
    const registration = registerTool.mock.calls.find(([tool]) => tool === name);
    expect(registration).toBeDefined();
    const config = registration![1];
    expect(config.description).toContain("public");
    expect(config.description).toContain("explicitly approved for public publication");
    expect(config.description).toContain("never confidential material");
    expect(config.description).not.toMatch(/arweave|permanent/i);
    expect(config.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  },
);

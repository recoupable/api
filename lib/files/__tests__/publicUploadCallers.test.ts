import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGenerateTxtFileTool } from "@/lib/mcp/tools/files/registerGenerateTxtFileTool";
import { registerCreateKnowledgeBaseTool } from "@/lib/mcp/tools/files/registerCreateKnowledgeBaseTool";
import { registerGenerateImageTool } from "@/lib/mcp/tools/images/registerGenerateImageTool";
import { registerEditImageTool } from "@/lib/mcp/tools/images/registerEditImageTool";
import { generateAndStoreTxtFile } from "../generateAndStoreTxtFile";
import { createKnowledgeBase } from "@/lib/artist/createKnowledgeBase";
import { generateAndProcessImage } from "@/lib/image/generateAndProcessImage";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
vi.mock("../generateAndStoreTxtFile", () => ({ generateAndStoreTxtFile: vi.fn() }));
vi.mock("@/lib/artist/createKnowledgeBase", () => ({ createKnowledgeBase: vi.fn() }));
vi.mock("@/lib/image/generateAndProcessImage", () => ({ generateAndProcessImage: vi.fn() }));
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
const authInfo = { extra: { accountId: "authenticated-actor" } };
function handler(register: (server: McpServer) => void) {
  const registerTool = vi.fn();
  register({ registerTool } as unknown as McpServer);
  return registerTool.mock.calls[0][2];
}
describe("public writer MCP callers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveAccountId).mockResolvedValue({
      accountId: "authenticated-actor",
      error: null,
    });
    vi.mocked(generateAndStoreTxtFile).mockResolvedValue({
      txt: { base64Data: "aGk=", mimeType: "text/plain" },
      txtUrl: "https://storage/txt",
      metadataUrl: "https://storage/meta",
      arweave: "https://storage/txt",
      metadataArweave: "https://storage/meta",
    });
    vi.mocked(generateAndProcessImage).mockResolvedValue({ imageUrl: "https://storage/image" });
    vi.mocked(createKnowledgeBase).mockResolvedValue({
      url: "https://storage/txt",
      name: "Bio",
      type: "text/plain",
    });
  });
  it("returns new TXT URL fields and backward-compatible HTTPS aliases", async () => {
    const result = await handler(registerGenerateTxtFileTool)({ contents: "hi" }, { authInfo });
    expect(generateAndStoreTxtFile).toHaveBeenCalledWith("hi", "authenticated-actor");
    expect(JSON.stringify(result)).toContain("txtUrl");
    expect(JSON.stringify(result)).toContain("arweaveUrl");
    expect(JSON.stringify(result)).not.toContain("stored on Arweave");
  });
  it("uses verified caller for attribution, never the supplied image account", async () => {
    await handler(registerGenerateImageTool)(
      { prompt: "p", account_id: "legacy-target" },
      { authInfo },
    );
    expect(resolveAccountId).toHaveBeenCalledWith({ authInfo, accountIdOverride: undefined });
    expect(generateAndProcessImage).toHaveBeenCalledWith(
      "p",
      "legacy-target",
      undefined,
      "authenticated-actor",
    );
    await handler(registerEditImageTool)(
      { prompt: "p", account_id: "legacy-target", imageUrl: "https://source/image" },
      { authInfo },
    );
    expect(generateAndProcessImage).toHaveBeenLastCalledWith(
      "p",
      "legacy-target",
      [{ url: "https://source/image", type: "image/png" }],
      "authenticated-actor",
    );
  });
  it("attributes knowledge storage to caller rather than target artist", async () => {
    await handler(registerCreateKnowledgeBaseTool)(
      { artistId: "artist", knowledgeBaseText: "Bio" },
      { authInfo },
    );
    expect(createKnowledgeBase).toHaveBeenCalledWith("artist", "Bio", "authenticated-actor");
  });
  it("does not expose storage internals through TXT or knowledge errors", async () => {
    vi.mocked(generateAndStoreTxtFile).mockRejectedValueOnce(new Error("private-storage-detail"));
    vi.mocked(createKnowledgeBase).mockRejectedValueOnce(new Error("private-storage-detail"));
    const text = await handler(registerGenerateTxtFileTool)({ contents: "hi" }, { authInfo });
    const knowledge = await handler(registerCreateKnowledgeBaseTool)(
      { artistId: "artist", knowledgeBaseText: "Bio" },
      { authInfo },
    );
    expect(JSON.stringify([text, knowledge])).not.toContain("private-storage-detail");
    expect(JSON.stringify(text)).toContain("Failed to generate TXT file");
    expect(JSON.stringify(knowledge)).toContain("Failed to create knowledge base");
  });
  it.each([
    registerGenerateTxtFileTool,
    registerCreateKnowledgeBaseTool,
    registerGenerateImageTool,
    registerEditImageTool,
  ])("does not write without verified auth", async register => {
    vi.mocked(resolveAccountId).mockResolvedValue({
      accountId: null,
      error: "Authentication required",
    });
    await handler(register)(
      {
        contents: "hi",
        artistId: "artist",
        knowledgeBaseText: "bio",
        prompt: "p",
        account_id: "claimed",
        imageUrl: "https://source/image",
      },
      {},
    );
    expect(generateAndStoreTxtFile).not.toHaveBeenCalled();
    expect(generateAndProcessImage).not.toHaveBeenCalled();
    expect(createKnowledgeBase).not.toHaveBeenCalled();
  });
});

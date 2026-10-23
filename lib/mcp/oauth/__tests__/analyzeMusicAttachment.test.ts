import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";

vi.mock("../../tools", async () => {
  const { registerAnalyzeMusicTool } = await import(
    "../../tools/flamingo/registerAnalyzeMusicTool"
  );
  return { registerAllTools: registerAnalyzeMusicTool };
});
vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: vi.fn().mockResolvedValue({ accountId: "owner" }),
}));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({
  verifyAudioUrl: vi.fn().mockResolvedValue({ ok: true, contentType: "audio/mpeg" }),
}));
vi.mock("@/lib/credits/checkCreditsAvailable", () => ({
  checkCreditsAvailable: vi.fn().mockResolvedValue({ kind: "ok" }),
}));
vi.mock("@/lib/flamingo/processAnalyzeMusicRequest", () => ({
  processAnalyzeMusicRequest: vi
    .fn()
    .mockResolvedValue({ type: "success", response: "warm", elapsed_seconds: 1 }),
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
    token: "token",
    clientId: "client",
    scopes: access.scopes,
    extra: { accountId: "owner", oauth: access },
  },
};

describe("OAuth song attachment handoff", () => {
  it("preserves file metadata and routes the host attachment through authenticated analysis", async () => {
    const registered = new Map<string, { config: any; run: any }>();
    const server = {
      registerTool: (name, config, run) => registered.set(name, { config, run }),
    } as unknown as McpServer;
    const prepare = vi.fn(async (_name: string, args: Record<string, unknown>) => args);
    registerFullOAuthTools(server, async () => access, {
      prepare,
      listArtists: vi.fn().mockResolvedValue([]),
    });
    const tool = registered.get("analyze_music")!;
    expect(tool.config._meta["openai/fileParams"]).toEqual(["file"]);
    const file = {
      file_id: "file_selected",
      download_url: "https://host.example/audio?token=private",
    };
    expect(tool.config.inputSchema.safeParse({ file, preset: "catalog_metadata" }).success).toBe(
      true,
    );
    const result = await tool.run({ file, preset: "catalog_metadata" }, extra);
    expect(result.isError).not.toBe(true);
    expect(processAnalyzeMusicRequest).toHaveBeenCalledWith(
      expect.objectContaining({ audio_url: file.download_url, preset: "catalog_metadata" }),
      { accountId: "owner", recordAudioUrl: false },
    );
    expect(JSON.stringify(result)).not.toContain(file.download_url);
    vi.mocked(processAnalyzeMusicRequest).mockClear();
    const ambiguous = await tool.run(
      { file, audio_url: "https://example.com/other.mp3", preset: "catalog_metadata" },
      extra,
    );
    expect(ambiguous.isError).toBe(true);
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
  });
});

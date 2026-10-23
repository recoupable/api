import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { analyzeMusicToolSchema } from "../analyzeMusicToolSchema";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAnalyzeMusicTool } from "../registerAnalyzeMusicTool";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";

vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: vi.fn().mockResolvedValue({ accountId: "acc_1", error: null }),
}));
vi.mock("@/lib/credits/checkCreditsAvailable", () => ({ checkCreditsAvailable: vi.fn() }));
vi.mock("@/lib/flamingo/processAnalyzeMusicRequest", () => ({
  processAnalyzeMusicRequest: vi.fn(),
}));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({ verifyAudioUrl: vi.fn() }));

const AUDIO = "https://cdn.example.com/track.mp3";
const extra = { authInfo: { extra: { accountId: "acc_1", orgId: null } } };

describe("registerAnalyzeMusicTool — audio_url guard", () => {
  let handler: (args: unknown, extra: unknown) => Promise<{ content: { text: string }[] }>;
  let registered: {
    description: string;
    _meta: Record<string, unknown>;
    inputSchema: { safeParse: (v: unknown) => { success: boolean } };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCreditsAvailable).mockResolvedValue({ kind: "ok" } as never);
    const server = {
      registerTool: vi.fn((_name, schema, fn) => {
        registered = schema;
        handler = fn;
      }),
    } as unknown as McpServer;
    registerAnalyzeMusicTool(server);
  });

  it("requires an attachment or URL and advertises the native file parameter", () => {
    expect(registered._meta["openai/fileParams"]).toEqual(["file"]);
    expect(registered.inputSchema.safeParse({ prompt: "Genre?" }).success).toBe(false);
    expect(registered.inputSchema.safeParse({ prompt: "Genre?", audio_url: AUDIO }).success).toBe(
      true,
    );
  });

  it("returns the verification message as a tool error before the credit gate", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({
      ok: false,
      error: "audio_url_not_audio",
      message: "audio_url answered 200 with content type text/html",
    });

    const result = await handler({ preset: "mood_tags", audio_url: AUDIO }, extra);

    expect(JSON.parse(result.content[0].text)).toEqual({
      success: false,
      message: "audio_url answered 200 with content type text/html",
    });
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
  });

  it("runs the analysis when the audio verifies", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({ ok: true, contentType: "audio/mpeg" });
    vi.mocked(processAnalyzeMusicRequest).mockResolvedValue({
      type: "success",
      preset: "mood_tags",
      response: ["warm"],
      elapsed_seconds: 2,
    });

    const result = await handler({ preset: "mood_tags", audio_url: AUDIO }, extra);

    expect(JSON.parse(result.content[0].text)).toMatchObject({ preset: "mood_tags" });
    expect(verifyAudioUrl).toHaveBeenCalledWith(AUDIO);
    expect(checkCreditsAvailable).toHaveBeenCalledTimes(1);
    expect(processAnalyzeMusicRequest).toHaveBeenCalledWith(
      expect.objectContaining({ preset: "mood_tags", audio_url: AUDIO }),
      { accountId: "acc_1" },
    );
  });
  it("accepts a host attachment with only the required file fields", () => {
    expect(
      registered.inputSchema.safeParse({
        preset: "catalog_metadata",
        file: {
          file_id: "file_selected",
          download_url: AUDIO,
        },
      }).success,
    ).toBe(true);
  });

  it.each([
    { file: { file_id: "file_selected" } },
    { file: { download_url: AUDIO } },
    { file: { file_id: "file_selected", download_url: "file:///tmp/song.mp3" } },
    { file: { file_id: "file_selected", download_url: AUDIO }, audio_url: AUDIO },
  ])("rejects missing, non-HTTPS or ambiguous attachment inputs: %j", source => {
    expect(
      registered.inputSchema.safeParse({ preset: "catalog_metadata", ...source }).success,
    ).toBe(false);
  });

  it("analyzes attached audio through the existing pipeline without persisting the temporary URL", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({ ok: true, contentType: "audio/mpeg" });
    vi.mocked(processAnalyzeMusicRequest).mockResolvedValue({
      type: "success",
      response: "warm",
      elapsed_seconds: 2,
    });
    const file = {
      file_id: "file_selected",
      download_url: AUDIO + "?token=private",
      file_name: "Demo.mp3",
      mime_type: "audio/mpeg",
    };
    await handler({ preset: "catalog_metadata", file }, extra);
    expect(verifyAudioUrl).toHaveBeenCalledWith(file.download_url);
    expect(processAnalyzeMusicRequest).toHaveBeenCalledWith(
      expect.objectContaining({ preset: "catalog_metadata", audio_url: file.download_url }),
      { accountId: "acc_1", recordAudioUrl: false },
    );
    expect(vi.mocked(processAnalyzeMusicRequest).mock.calls[0][0]).not.toHaveProperty("file");
  });

  it("asks to reattach expired audio without asking for hosting or charging", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({
      ok: false,
      error: "audio_url_unreachable",
      message: "audio_url answered HTTP 403",
    });
    const result = await handler(
      { preset: "catalog_metadata", file: { file_id: "file_selected", download_url: AUDIO } },
      extra,
    );
    expect(JSON.parse(result.content[0].text).message).toMatch(/attach.*again/i);
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
  });

  it("declares all four host file fields with exactly two required fields", () => {
    const schema = z.toJSONSchema(analyzeMusicToolSchema, { io: "input" });
    const file = schema.properties!.file as { properties: object; required: string[] };
    expect(Object.keys(file.properties).sort()).toEqual([
      "download_url",
      "file_id",
      "file_name",
      "mime_type",
    ]);
    expect(file.required.sort()).toEqual(["download_url", "file_id"]);
    expect(schema.required ?? []).not.toContain("audio_url");
  });

  it("keeps authentication ahead of fetching an attachment", async () => {
    vi.mocked(resolveAccountId).mockResolvedValueOnce({
      accountId: null,
      error: "Authentication required",
    } as never);
    await handler(
      { preset: "catalog_metadata", file: { file_id: "file_selected", download_url: AUDIO } },
      extra,
    );
    expect(verifyAudioUrl).not.toHaveBeenCalled();
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
  });

  it("rejects non-audio attachments before checking credits", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({
      ok: false,
      error: "audio_url_not_audio",
      message: "text/html",
    });
    const result = await handler(
      { preset: "catalog_metadata", file: { file_id: "file_selected", download_url: AUDIO } },
      extra,
    );
    expect(JSON.parse(result.content[0].text).message).toContain("Attach an MP3, WAV, or FLAC");
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
  });
});

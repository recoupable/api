import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAnalyzeMusicTool } from "../registerAnalyzeMusicTool";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";
import { assertAnalyzeWithinPlan } from "@/lib/plans/assertAnalyzeWithinPlan";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";
import { buildAnalyzePlanLimitBody } from "@/lib/plans/buildAnalyzePlanLimitBody";

vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: vi.fn().mockResolvedValue({ accountId: "acc_1", error: null }),
}));
vi.mock("@/lib/credits/checkCreditsAvailable", () => ({ checkCreditsAvailable: vi.fn() }));
vi.mock("@/lib/flamingo/processAnalyzeMusicRequest", () => ({
  processAnalyzeMusicRequest: vi.fn(),
}));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({ verifyAudioUrl: vi.fn() }));
vi.mock("@/lib/plans/assertAnalyzeWithinPlan", () => ({ assertAnalyzeWithinPlan: vi.fn() }));

const AUDIO = "https://cdn.example.com/track.mp3";
const extra = { authInfo: { extra: { accountId: "acc_1", orgId: null } } };

describe("registerAnalyzeMusicTool — audio_url guard", () => {
  let handler: (args: unknown, extra: unknown) => Promise<{ content: { text: string }[] }>;
  let registered: {
    description: string;
    inputSchema: { safeParse: (v: unknown) => { success: boolean } };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCreditsAvailable).mockResolvedValue({ kind: "ok" } as never);
    vi.mocked(assertAnalyzeWithinPlan).mockResolvedValue(undefined);
    const server = {
      registerTool: vi.fn((_name, schema, fn) => {
        registered = schema;
        handler = fn;
      }),
    } as unknown as McpServer;
    registerAnalyzeMusicTool(server);
  });

  it("tells the model audio_url is required, and the schema rejects a body without it", () => {
    expect(registered.description).toMatch(/audio_url is required/);
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

  it("returns the plan-limit message as a tool error before the credit gate", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({ ok: true, contentType: "audio/mpeg" });
    vi.mocked(assertAnalyzeWithinPlan).mockRejectedValue(
      new PlanLimitError(buildAnalyzePlanLimitBody({ plan: "free", currentAnalyzeCount: 5 })),
    );

    const result = await handler({ preset: "mood_tags", audio_url: AUDIO }, extra);

    expect(JSON.parse(result.content[0].text)).toEqual({
      success: false,
      message: "Free includes 5 tracks analyzed a month. Starter and Pro are unlimited.",
    });
    expect(assertAnalyzeWithinPlan).toHaveBeenCalledWith({ accountId: "acc_1", audioUrl: AUDIO });
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
    expect(processAnalyzeMusicRequest).not.toHaveBeenCalled();
  });

  it("names the plan lookup, not the balance, when the plan gate itself throws", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({ ok: true, contentType: "audio/mpeg" });
    vi.mocked(assertAnalyzeWithinPlan).mockRejectedValue(new Error("stripe down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await handler({ preset: "mood_tags", audio_url: AUDIO }, extra);

    expect(JSON.parse(result.content[0].text)).toEqual({
      success: false,
      message: "Plan check failed",
    });
    expect(checkCreditsAvailable).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

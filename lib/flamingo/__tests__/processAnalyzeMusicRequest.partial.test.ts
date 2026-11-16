import { describe, it, expect, vi, beforeEach } from "vitest";
import { processAnalyzeMusicRequest } from "../processAnalyzeMusicRequest";

const mockExecuteFullReport = vi.fn();

vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({ callFlamingoGenerate: vi.fn() }));
vi.mock("@/lib/flamingo/presets", () => ({ getPreset: vi.fn() }));
vi.mock("@/lib/flamingo/executeFullReport", () => ({
  executeFullReport: (...args: unknown[]) => mockExecuteFullReport(...args),
}));
vi.mock("@/lib/flamingo/chargeForFlamingoCall", () => ({
  chargeForFlamingoCall: vi.fn().mockResolvedValue(undefined),
}));

const CTX = { accountId: "acc_test" };
const BODY = {
  preset: "full_report",
  audio_url: "https://example.com/song.mp3",
  max_new_tokens: 512,
  temperature: 1.0,
  top_p: 1.0,
  do_sample: false,
};

describe("processAnalyzeMusicRequest — full_report completeness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status success when no section failed", async () => {
    mockExecuteFullReport.mockResolvedValue({
      report: { overview: { genre: "pop" } },
      elapsed_seconds: 12,
      failed: [],
    });

    const result = await processAnalyzeMusicRequest(BODY, CTX);

    expect(result).toEqual({
      type: "success",
      status: "success",
      preset: "full_report",
      report: { overview: { genre: "pop" } },
      elapsed_seconds: 12,
      failed: [],
    });
  });

  it("returns status partial with the failed keys when some sections failed", async () => {
    mockExecuteFullReport.mockResolvedValue({
      report: { overview: { genre: "pop" }, sync: { error: "Section failed: x" } },
      elapsed_seconds: 12,
      failed: ["sync"],
    });

    const result = await processAnalyzeMusicRequest(BODY, CTX);

    expect(result).toMatchObject({ type: "success", status: "partial", failed: ["sync"] });
  });

  it("returns an upstream error when every section failed", async () => {
    const failed = ["overview", "mood", "sync"];
    mockExecuteFullReport.mockResolvedValue({
      report: Object.fromEntries(failed.map(k => [k, { error: "Section failed: x" }])),
      elapsed_seconds: 3,
      failed,
    });

    const result = await processAnalyzeMusicRequest(BODY, CTX);

    expect(result).toEqual({
      type: "upstream_error",
      error: "Music analysis failed for every section",
      failed,
    });
  });
});

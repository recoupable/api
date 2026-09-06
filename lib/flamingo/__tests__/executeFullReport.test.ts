import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeFullReport } from "../executeFullReport";
import { chargeForFlamingoCall } from "@/lib/flamingo/chargeForFlamingoCall";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { FULL_REPORT_SECTIONS } from "@/lib/flamingo/presets/fullReport";

vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({ callFlamingoGenerate: vi.fn() }));
vi.mock("@/lib/flamingo/chargeForFlamingoCall", () => ({ chargeForFlamingoCall: vi.fn() }));

const AUDIO = "https://example.com/song.mp3";

describe("executeFullReport — credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chargeForFlamingoCall).mockResolvedValue(undefined);
  });

  it("charges one deduction per section, each on that section's own seconds", async () => {
    let n = 0;
    vi.mocked(callFlamingoGenerate).mockImplementation(async () => ({
      response: "ok",
      elapsed_seconds: ++n,
    }));

    const { report } = await executeFullReport(AUDIO, "acc_1");

    expect(Object.keys(report)).toHaveLength(FULL_REPORT_SECTIONS.length);
    expect(chargeForFlamingoCall).toHaveBeenCalledTimes(FULL_REPORT_SECTIONS.length);
    const seconds = vi
      .mocked(chargeForFlamingoCall)
      .mock.calls.map(([args]) => args.elapsedSeconds)
      .sort((a, b) => a - b);
    expect(seconds).toEqual(FULL_REPORT_SECTIONS.map((_, i) => i + 1));
    for (const [args] of vi.mocked(chargeForFlamingoCall).mock.calls) {
      expect(args).toMatchObject({ accountId: "acc_1", audioUrl: AUDIO });
    }
  });

  it("does not charge for a section whose model call failed", async () => {
    let n = 0;
    vi.mocked(callFlamingoGenerate).mockImplementation(async () => {
      n += 1;
      if (n === 1) throw new Error("Music analysis failed (status 503)");
      return { response: "ok", elapsed_seconds: 3 };
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { report } = await executeFullReport(AUDIO, "acc_1");

    expect(Object.keys(report)).toHaveLength(FULL_REPORT_SECTIONS.length);
    expect(chargeForFlamingoCall).toHaveBeenCalledTimes(FULL_REPORT_SECTIONS.length - 1);
    errorSpy.mockRestore();
  });
});

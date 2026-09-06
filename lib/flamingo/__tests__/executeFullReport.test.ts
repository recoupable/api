import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeFullReport } from "../executeFullReport";
import { chargeForFlamingoCall } from "@/lib/flamingo/chargeForFlamingoCall";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { getPreset } from "@/lib/flamingo/presets";
import { FULL_REPORT_SECTIONS } from "@/lib/flamingo/presets/fullReport";

vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({ callFlamingoGenerate: vi.fn() }));
vi.mock("@/lib/flamingo/chargeForFlamingoCall", () => ({ chargeForFlamingoCall: vi.fn() }));
vi.mock("@/lib/flamingo/presets", () => ({ getPreset: vi.fn() }));

const AUDIO = "https://example.com/song.mp3";
const N = FULL_REPORT_SECTIONS.length;
const plainPreset = (name: string) => ({
  name,
  prompt: `prompt for ${name}`,
  params: { max_new_tokens: 64, temperature: 0.2, do_sample: false },
});

describe("executeFullReport — credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chargeForFlamingoCall).mockResolvedValue(undefined);
    vi.mocked(getPreset).mockImplementation(name => plainPreset(name) as never);
  });

  it("charges one deduction per section, each on that section's own seconds", async () => {
    let n = 0;
    vi.mocked(callFlamingoGenerate).mockImplementation(async () => {
      n += 1;
      return { response: "ok", elapsed_seconds: n, cost_usd: n * 0.000583 };
    });

    const { report } = await executeFullReport(AUDIO, "acc_1");

    expect(Object.keys(report)).toHaveLength(N);
    expect(chargeForFlamingoCall).toHaveBeenCalledTimes(N);
    const seconds = vi
      .mocked(chargeForFlamingoCall)
      .mock.calls.map(([args]) => args.elapsedSeconds)
      .sort((a, b) => a - b);
    expect(seconds).toEqual(FULL_REPORT_SECTIONS.map((_, i) => i + 1));
    for (const [args] of vi.mocked(chargeForFlamingoCall).mock.calls) {
      expect(args).toMatchObject({ accountId: "acc_1", audioUrl: AUDIO });
      expect(args.costUsd).toBeCloseTo(args.elapsedSeconds * 0.000583, 9);
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

    expect(Object.keys(report)).toHaveLength(N);
    expect(chargeForFlamingoCall).toHaveBeenCalledTimes(N - 1);
    errorSpy.mockRestore();
  });

  it("does not charge for a section whose response failed to parse", async () => {
    // A section that reports `{ error }` to the caller is a failed section,
    // and the contract says a failed section costs nothing.
    vi.mocked(getPreset).mockImplementation(name =>
      name === FULL_REPORT_SECTIONS[0].preset
        ? ({
            ...plainPreset(name),
            parseResponse: () => {
              throw new SyntaxError("not JSON");
            },
          } as never)
        : (plainPreset(name) as never),
    );
    vi.mocked(callFlamingoGenerate).mockResolvedValue({ response: "ok", elapsed_seconds: 3 });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { report } = await executeFullReport(AUDIO, "acc_1");

    expect(report[FULL_REPORT_SECTIONS[0].reportKey]).toMatchObject({
      error: expect.stringContaining("Section failed"),
    });
    expect(chargeForFlamingoCall).toHaveBeenCalledTimes(N - 1);
    errorSpy.mockRestore();
  });
});

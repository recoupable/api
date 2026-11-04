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
const plainPreset = (name: string) => ({
  name,
  prompt: `prompt for ${name}`,
  params: { max_new_tokens: 64, temperature: 0.2, do_sample: false },
});

describe("executeFullReport — failed sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chargeForFlamingoCall).mockResolvedValue(undefined);
    vi.mocked(getPreset).mockImplementation(name => plainPreset(name) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lists no failed sections when every call succeeds", async () => {
    vi.mocked(callFlamingoGenerate).mockResolvedValue({ response: "ok", elapsed_seconds: 1 });

    const { failed } = await executeFullReport(AUDIO, "acc_1");

    expect(failed).toEqual([]);
  });

  it("lists the report keys of the sections that failed, in report order", async () => {
    const failing = new Set([FULL_REPORT_SECTIONS[0].preset, FULL_REPORT_SECTIONS[4].preset]);
    vi.mocked(callFlamingoGenerate).mockImplementation(async ({ prompt }) => {
      const name = prompt.replace("prompt for ", "");
      if (failing.has(name)) throw new Error("Music analysis failed (status 500)");
      return { response: "ok", elapsed_seconds: 1 };
    });

    const { report, failed } = await executeFullReport(AUDIO, "acc_1");

    expect(failed).toEqual([FULL_REPORT_SECTIONS[0].reportKey, FULL_REPORT_SECTIONS[4].reportKey]);
    expect(report[FULL_REPORT_SECTIONS[0].reportKey]).toEqual({
      error: "Section failed: Music analysis failed (status 500)",
    });
  });

  it("lists every section when the model fails every call", async () => {
    vi.mocked(callFlamingoGenerate).mockRejectedValue(
      new Error("Music analysis failed (status 500)"),
    );

    const { failed } = await executeFullReport(AUDIO, "acc_1");

    expect(failed).toEqual(FULL_REPORT_SECTIONS.map(s => s.reportKey));
    expect(chargeForFlamingoCall).not.toHaveBeenCalled();
  });
});

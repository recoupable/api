import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeFullReport } from "../executeFullReport";
import { chargeForBatchAnswers } from "@/lib/flamingo/chargeForBatchAnswers";
import { callFlamingoGenerateBatch } from "@/lib/flamingo/callFlamingoGenerateBatch";
import { getPreset } from "@/lib/flamingo/presets";
import { FULL_REPORT_SECTIONS } from "@/lib/flamingo/presets/fullReport";
import type { FlamingoBatchAnswer } from "@/lib/flamingo/isFlamingoGenerateBatchResult";

vi.mock("@/lib/flamingo/callFlamingoGenerateBatch", () => ({
  callFlamingoGenerateBatch: vi.fn(),
}));
vi.mock("@/lib/flamingo/chargeForBatchAnswers", () => ({ chargeForBatchAnswers: vi.fn() }));
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
    vi.mocked(chargeForBatchAnswers).mockResolvedValue(undefined);
    vi.mocked(getPreset).mockImplementation(name => plainPreset(name) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lists no failed sections when every section answers", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: FULL_REPORT_SECTIONS.map(s => ({
        id: s.reportKey,
        response: "ok",
        elapsed_seconds: 1,
      })),
      elapsed_seconds: 14,
    });

    const { failed } = await executeFullReport(AUDIO, "acc_1");

    expect(failed).toEqual([]);
  });

  it("lists a section the batch returned no answer for, in report order", async () => {
    const missing = new Set([FULL_REPORT_SECTIONS[0].reportKey, FULL_REPORT_SECTIONS[4].reportKey]);
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: FULL_REPORT_SECTIONS.filter(s => !missing.has(s.reportKey)).map(s => ({
        id: s.reportKey,
        response: "ok",
        elapsed_seconds: 1,
      })),
      elapsed_seconds: 12,
    });

    const { report, failed } = await executeFullReport(AUDIO, "acc_1");

    expect(failed).toEqual([FULL_REPORT_SECTIONS[0].reportKey, FULL_REPORT_SECTIONS[4].reportKey]);
    expect(report[FULL_REPORT_SECTIONS[0].reportKey]).toEqual({
      error: "Section failed: the model returned no answer for this section",
    });
  });

  it("counts a section whose parsed answer is only an { error } as failed and does not charge it", async () => {
    // A model reply of {"error": "..."} parses into the same shape the report
    // uses for a failed section, so it is reported as failed and not billed.
    vi.mocked(getPreset).mockImplementation(name =>
      name === FULL_REPORT_SECTIONS[1].preset
        ? ({ ...plainPreset(name), parseResponse: (raw: string) => JSON.parse(raw) } as never)
        : (plainPreset(name) as never),
    );
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: FULL_REPORT_SECTIONS.map((s, i) => ({
        id: s.reportKey,
        response: i === 1 ? '{"error": "cannot analyze"}' : "ok",
        elapsed_seconds: 1,
      })),
      elapsed_seconds: 14,
    });

    const { failed } = await executeFullReport(AUDIO, "acc_1");

    expect(failed).toEqual([FULL_REPORT_SECTIONS[1].reportKey]);
    const [charge] = vi.mocked(chargeForBatchAnswers).mock.calls[0];
    expect((charge.answers as FlamingoBatchAnswer[]).map(a => a.id)).toEqual(
      FULL_REPORT_SECTIONS.filter((_, i) => i !== 1).map(s => s.reportKey),
    );
  });

  it("fails every section, with the batch's error, and charges nothing when the batch fails", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockRejectedValue(
      new Error("Music analysis failed (status 500)"),
    );

    const { report, failed } = await executeFullReport(AUDIO, "acc_1");

    expect(failed).toEqual(FULL_REPORT_SECTIONS.map(s => s.reportKey));
    expect(report[FULL_REPORT_SECTIONS[2].reportKey]).toEqual({
      error: "Section failed: Music analysis failed (status 500)",
    });
    expect(chargeForBatchAnswers).toHaveBeenCalledWith({
      accountId: "acc_1",
      answers: [],
      audioUrl: AUDIO,
    });
  });
});

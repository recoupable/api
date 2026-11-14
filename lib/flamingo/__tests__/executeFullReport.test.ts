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
const N = FULL_REPORT_SECTIONS.length;
const plainPreset = (name: string) => ({
  name,
  prompt: `prompt for ${name}`,
  params: { max_new_tokens: 64, temperature: 0.2, do_sample: false },
});
/** One answer per section, keyed by report key, each taking `seconds`. */
const answersFor = (seconds: number) =>
  FULL_REPORT_SECTIONS.map(s => ({ id: s.reportKey, response: "ok", elapsed_seconds: seconds }));

describe("executeFullReport — one batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chargeForBatchAnswers).mockResolvedValue(undefined);
    vi.mocked(getPreset).mockImplementation(name => plainPreset(name) as never);
  });

  it("asks every section in one batch on one download, each with its preset's own settings", async () => {
    vi.mocked(getPreset).mockImplementation(name =>
      name === "song_description"
        ? ({
            ...plainPreset(name),
            params: { max_new_tokens: 256, temperature: 0.7, do_sample: true },
          } as never)
        : (plainPreset(name) as never),
    );
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: answersFor(2),
      elapsed_seconds: 30,
    });

    await executeFullReport(AUDIO, "acc_1");

    expect(callFlamingoGenerateBatch).toHaveBeenCalledTimes(1);
    const [batch] = vi.mocked(callFlamingoGenerateBatch).mock.calls[0];
    expect(batch).toMatchObject({ audio_url: AUDIO, top_p: 1, do_sample: false });
    expect(batch.prompts.map(p => p.id)).toEqual(FULL_REPORT_SECTIONS.map(s => s.reportKey));
    expect(batch.prompts.find(p => p.id === "description")).toEqual({
      id: "description",
      prompt: "prompt for song_description",
      max_new_tokens: 256,
      temperature: 0.7,
      do_sample: true,
    });
    expect(batch.prompts.find(p => p.id === "overview")).toEqual({
      id: "overview",
      prompt: "prompt for catalog_metadata",
      max_new_tokens: 64,
      temperature: 0.2,
      do_sample: false,
    });
  });

  it("assembles the report in narrative order and charges one batch for every section", async () => {
    const answers = answersFor(2).reverse();
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({ answers, elapsed_seconds: 30 });

    const { report, failed } = await executeFullReport(AUDIO, "acc_1");

    expect(Object.keys(report)).toEqual(FULL_REPORT_SECTIONS.map(s => s.reportKey));
    expect(failed).toEqual([]);
    expect(chargeForBatchAnswers).toHaveBeenCalledTimes(1);
    const [charge] = vi.mocked(chargeForBatchAnswers).mock.calls[0];
    expect(charge).toMatchObject({ accountId: "acc_1", audioUrl: AUDIO });
    expect(charge.answers).toHaveLength(N);
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
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: answersFor(3),
      elapsed_seconds: 45,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { report } = await executeFullReport(AUDIO, "acc_1");

    expect(report[FULL_REPORT_SECTIONS[0].reportKey]).toEqual({
      error: "Section failed: not JSON",
    });
    const [charge] = vi.mocked(chargeForBatchAnswers).mock.calls[0];
    expect((charge.answers as FlamingoBatchAnswer[]).map(a => a.id)).toEqual(
      FULL_REPORT_SECTIONS.slice(1).map(s => s.reportKey),
    );
    errorSpy.mockRestore();
  });

  it("does not persist temporary attachment URLs in the usage record", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: answersFor(3),
      elapsed_seconds: 45,
    });

    await executeFullReport(AUDIO, "acc_1", false);

    const [charge] = vi.mocked(chargeForBatchAnswers).mock.calls[0];
    expect(charge).not.toHaveProperty("audioUrl");
  });
});

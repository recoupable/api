import { describe, it, expect, vi, beforeEach } from "vitest";
import { processAnalyzeMusicBatchRequest } from "../processAnalyzeMusicBatchRequest";
import { callFlamingoGenerateBatch } from "@/lib/flamingo/callFlamingoGenerateBatch";
import { chargeForFlamingoBatch } from "@/lib/flamingo/chargeForFlamingoBatch";
import { FlamingoServiceError } from "@/lib/flamingo/FlamingoServiceError";
import type { FlamingoGenerateBatchBody } from "@/lib/flamingo/flamingoGenerateBatchBodySchema";

vi.mock("@/lib/flamingo/callFlamingoGenerateBatch", () => ({
  callFlamingoGenerateBatch: vi.fn(),
}));
vi.mock("@/lib/flamingo/chargeForFlamingoBatch", () => ({ chargeForFlamingoBatch: vi.fn() }));

const BODY: FlamingoGenerateBatchBody = {
  audio_url: "https://example.com/song.mp3",
  prompts: [
    { id: "genre", prompt: "What genre?", max_new_tokens: 400 },
    { id: "tempo", prompt: "What tempo?", max_new_tokens: 32 },
    { id: "mood", prompt: "What mood?", max_new_tokens: 64 },
  ],
  temperature: 0.2,
  top_p: 1,
  do_sample: false,
};

const ANSWERS = [
  { id: "genre", response: "Jazz", elapsed_seconds: 1.4 },
  { id: "tempo", response: "120 BPM", elapsed_seconds: 0.6 },
  { id: "mood", response: "Warm", elapsed_seconds: 0.9 },
];

describe("processAnalyzeMusicBatchRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chargeForFlamingoBatch).mockResolvedValue(undefined);
  });

  it("returns every answer, the total seconds and the prompt count", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: ANSWERS,
      elapsed_seconds: 4.2,
    });

    const result = await processAnalyzeMusicBatchRequest(BODY, { accountId: "acc_1" });

    expect(callFlamingoGenerateBatch).toHaveBeenCalledWith(BODY);
    expect(result).toEqual({
      type: "success",
      answers: ANSWERS,
      elapsed_seconds: 4.2,
      prompts: 3,
    });
  });

  it("charges once, on the batch's total seconds, for the audio analyzed", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: ANSWERS,
      elapsed_seconds: 4.2,
    });

    await processAnalyzeMusicBatchRequest(BODY, { accountId: "acc_1" });

    expect(chargeForFlamingoBatch).toHaveBeenCalledTimes(1);
    expect(chargeForFlamingoBatch).toHaveBeenCalledWith({
      accountId: "acc_1",
      elapsedSeconds: 4.2,
      promptCount: 3,
      audioUrl: "https://example.com/song.mp3",
    });
  });

  it("leaves a private audio URL out of the usage record", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockResolvedValue({
      answers: ANSWERS,
      elapsed_seconds: 4.2,
    });

    await processAnalyzeMusicBatchRequest(BODY, { accountId: "acc_1", recordAudioUrl: false });

    expect(chargeForFlamingoBatch).toHaveBeenCalledWith({
      accountId: "acc_1",
      elapsedSeconds: 4.2,
      promptCount: 3,
    });
  });

  it("rethrows an upstream rejection and charges nothing", async () => {
    vi.mocked(callFlamingoGenerateBatch).mockRejectedValue(
      new FlamingoServiceError(503, "Service Unavailable"),
    );

    await expect(
      processAnalyzeMusicBatchRequest(BODY, { accountId: "acc_1" }),
    ).rejects.toBeInstanceOf(FlamingoServiceError);
    expect(chargeForFlamingoBatch).not.toHaveBeenCalled();
  });
});

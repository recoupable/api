import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { postFlamingoGenerateBatchHandler } from "../postFlamingoGenerateBatchHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureCreditsOrShortCircuit } from "@/lib/credits/ensureCreditsOrShortCircuit";
import { processAnalyzeMusicBatchRequest } from "@/lib/flamingo/processAnalyzeMusicBatchRequest";
import { FlamingoServiceError } from "@/lib/flamingo/FlamingoServiceError";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({
  verifyAudioUrl: vi.fn().mockResolvedValue({ ok: true, contentType: "audio/mpeg" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn(),
}));
vi.mock("@/lib/flamingo/processAnalyzeMusicBatchRequest", () => ({
  processAnalyzeMusicBatchRequest: vi.fn(),
}));

const BODY = {
  audio_url: "https://example.com/song.mp3",
  prompts: [
    { id: "genre", prompt: "What genre?" },
    { id: "tempo", prompt: "What tempo?" },
  ],
};

const ANSWERS = [
  { id: "genre", response: "Jazz", elapsed_seconds: 1.4 },
  { id: "tempo", response: "120 BPM", elapsed_seconds: 0.6 },
];

function request(body: unknown): NextRequest {
  return {
    headers: new Headers({ "x-api-key": "k" }),
    json: async () => body,
  } as unknown as NextRequest;
}

describe("postFlamingoGenerateBatchHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
      orgId: null,
      authToken: "k",
    });
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(null);
  });

  it("answers 200 with a flat body of answers, total seconds and prompt count", async () => {
    vi.mocked(processAnalyzeMusicBatchRequest).mockResolvedValue({
      type: "success",
      answers: ANSWERS,
      elapsed_seconds: 3.1,
      prompts: 2,
    });

    const res = await postFlamingoGenerateBatchHandler(request(BODY));

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({
      status: "success",
      answers: ANSWERS,
      elapsed_seconds: 3.1,
      prompts: 2,
    });
    expect(processAnalyzeMusicBatchRequest).toHaveBeenCalledWith(
      expect.objectContaining({ audio_url: BODY.audio_url, temperature: 0.2 }),
      { accountId: "acc_1" },
    );
  });

  it("gates the balance on one base price, however many prompts", async () => {
    vi.mocked(processAnalyzeMusicBatchRequest).mockResolvedValue({
      type: "success",
      answers: ANSWERS,
      elapsed_seconds: 3.1,
      prompts: 2,
    });

    await postFlamingoGenerateBatchHandler(request(BODY));

    expect(ensureCreditsOrShortCircuit).toHaveBeenCalledWith({
      accountId: "acc_1",
      creditsToDeduct: 50_000,
    });
  });

  it("returns the gate's 402 and never calls the model when credits are short", async () => {
    const short = NextResponse.json(
      { error: "insufficient_credits", remaining_credits: 0, required_credits: 50_000 },
      { status: 402 },
    );
    vi.mocked(ensureCreditsOrShortCircuit).mockResolvedValue(short);

    const res = await postFlamingoGenerateBatchHandler(request(BODY));

    expect(res.status).toBe(402);
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: "insufficient_credits", required_credits: 50_000 }),
    );
    expect(processAnalyzeMusicBatchRequest).not.toHaveBeenCalled();
  });

  it("answers a thrown gate with a CORS-bearing 500 and never calls the model", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(ensureCreditsOrShortCircuit).mockRejectedValue(new Error("db down"));

    const res = await postFlamingoGenerateBatchHandler(request(BODY));

    expect(res.status).toBe(500);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
    expect(processAnalyzeMusicBatchRequest).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("validates the body before touching the balance", async () => {
    const res = await postFlamingoGenerateBatchHandler(request({ audio_url: BODY.audio_url }));

    expect(res.status).toBe(400);
    expect(ensureCreditsOrShortCircuit).not.toHaveBeenCalled();
  });

  it("answers 502 with the upstream status and detail when the model service rejects the batch", async () => {
    vi.mocked(processAnalyzeMusicBatchRequest).mockRejectedValue(
      new FlamingoServiceError(422, "audio_undecodable: ffmpeg could not read the file"),
    );

    const res = await postFlamingoGenerateBatchHandler(request(BODY));

    expect(res.status).toBe(502);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({
      status: "error",
      error: "Music analysis failed (status 422)",
      upstream_status: 422,
      detail: "audio_undecodable: ffmpeg could not read the file",
    });
  });

  it("answers 500 with the message for any other failure", async () => {
    vi.mocked(processAnalyzeMusicBatchRequest).mockRejectedValue(
      new Error("Audio model returned an unexpected response shape"),
    );

    const res = await postFlamingoGenerateBatchHandler(request(BODY));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Audio model returned an unexpected response shape",
    });
  });

  it("answers 500 with a generic message when the failure is not an Error", async () => {
    vi.mocked(processAnalyzeMusicBatchRequest).mockRejectedValue("boom");

    const res = await postFlamingoGenerateBatchHandler(request(BODY));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Music analysis failed" });
  });
});

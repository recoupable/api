import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callFlamingoGenerateBatch } from "../callFlamingoGenerateBatch";
import type { FlamingoGenerateBatchBody } from "../flamingoGenerateBatchBodySchema";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const BODY: FlamingoGenerateBatchBody = {
  audio_url: "https://example.com/song.mp3",
  prompts: [
    { id: "genre", prompt: "What genre?", max_new_tokens: 400 },
    { id: "tempo", prompt: "What tempo?", max_new_tokens: 32 },
  ],
  temperature: 0.2,
  top_p: 1,
  do_sample: false,
};

const RESULT = {
  answers: [
    { id: "genre", response: "Jazz", elapsed_seconds: 1.4 },
    { id: "tempo", response: "120 BPM", elapsed_seconds: 0.6 },
  ],
  elapsed_seconds: 3.1,
};

describe("callFlamingoGenerateBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("posts every prompt in one request to the batch endpoint with proxy auth", async () => {
    vi.stubEnv("MODAL_PROXY_TOKEN_ID", "wk-test-id");
    vi.stubEnv("MODAL_PROXY_TOKEN_SECRET", "ws-test-secret");
    mockFetch.mockResolvedValue({ ok: true, json: async () => RESULT });

    const result = await callFlamingoGenerateBatch(BODY);

    expect(result).toEqual(RESULT);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://shared-78369--music-flamingo-musicflamingo-generate-batch.modal.run");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({
      "Content-Type": "application/json",
      "Modal-Key": "wk-test-id",
      "Modal-Secret": "ws-test-secret",
    });
    expect(JSON.parse(options.body)).toEqual({
      audio_url: "https://example.com/song.mp3",
      prompts: [
        { id: "genre", prompt: "What genre?", max_new_tokens: 400 },
        { id: "tempo", prompt: "What tempo?", max_new_tokens: 32 },
      ],
      temperature: 0.2,
      top_p: 1,
      do_sample: false,
    });
  });

  it("passes an abort signal through when given one", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => RESULT });
    const controller = new AbortController();

    await callFlamingoGenerateBatch(BODY, { signal: controller.signal });

    expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("throws FlamingoServiceError carrying the upstream status and body on a non-OK answer", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "audio_undecodable: bad file",
    });

    await expect(callFlamingoGenerateBatch(BODY)).rejects.toMatchObject({
      name: "FlamingoServiceError",
      message: "Music analysis failed (status 422)",
      status: 422,
      detail: "audio_undecodable: bad file",
    });
    errorSpy.mockRestore();
  });

  it("falls back to a placeholder detail when the error body cannot be read", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => {
        throw new Error("Cannot read body");
      },
    });

    await expect(callFlamingoGenerateBatch(BODY)).rejects.toMatchObject({
      status: 503,
      detail: "Unknown error",
    });
    errorSpy.mockRestore();
  });

  it.each([
    ["no answers array", { elapsed_seconds: 1 }],
    ["no total seconds", { answers: [] }],
    [
      "an answer without an id",
      { answers: [{ response: "x", elapsed_seconds: 1 }], elapsed_seconds: 1 },
    ],
    [
      "an answer whose response is not text",
      { answers: [{ id: "a", response: 42, elapsed_seconds: 1 }], elapsed_seconds: 1 },
    ],
    ["an answer without seconds", { answers: [{ id: "a", response: "x" }], elapsed_seconds: 1 }],
    ["null", null],
  ])("throws on an unexpected response shape: %s", async (_name, payload) => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => payload });

    await expect(callFlamingoGenerateBatch(BODY)).rejects.toThrow(
      "Audio model returned an unexpected response shape",
    );
  });
});

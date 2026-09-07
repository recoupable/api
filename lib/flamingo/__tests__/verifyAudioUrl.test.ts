import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyAudioUrl, AUDIO_URL_TIMEOUT_MS } from "../verifyAudioUrl";

const URL = "https://cdn.example.com/track.mp3";

function response(status: number, contentType?: string): Response {
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  return { ok: status >= 200 && status < 300, status, headers, body: null } as unknown as Response;
}

describe("verifyAudioUrl", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a HEAD 200 with an audio/* content type", async () => {
    fetchMock.mockResolvedValueOnce(response(200, "audio/mpeg"));

    const result = await verifyAudioUrl(URL);

    expect(result).toEqual({ ok: true, contentType: "audio/mpeg" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL);
    expect(init.method).toBe("HEAD");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("accepts application/octet-stream, ignoring charset parameters", async () => {
    fetchMock.mockResolvedValueOnce(response(200, "application/octet-stream; charset=binary"));

    const result = await verifyAudioUrl(URL);

    expect(result).toEqual({ ok: true, contentType: "application/octet-stream" });
  });

  it("falls back to a ranged GET when the host rejects HEAD", async () => {
    fetchMock
      .mockResolvedValueOnce(response(405))
      .mockResolvedValueOnce(response(206, "audio/wav"));

    const result = await verifyAudioUrl(URL);

    expect(result).toEqual({ ok: true, contentType: "audio/wav" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init] = fetchMock.mock.calls[1];
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ Range: "bytes=0-0" });
  });

  it("reports audio_url_unreachable when both HEAD and GET fail with a status", async () => {
    fetchMock.mockResolvedValueOnce(response(404)).mockResolvedValueOnce(response(404));

    const result = await verifyAudioUrl(URL);

    expect(result).toEqual({
      ok: false,
      error: "audio_url_unreachable",
      message: "audio_url answered HTTP 404",
    });
  });

  it("reports audio_url_unreachable when the request times out or throws", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "TimeoutError"));

    const result = await verifyAudioUrl(URL);

    expect(result).toEqual({
      ok: false,
      error: "audio_url_unreachable",
      message: `audio_url did not answer within ${AUDIO_URL_TIMEOUT_MS / 1000} seconds`,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports audio_url_not_audio for an HTML page", async () => {
    fetchMock.mockResolvedValueOnce(response(200, "text/html; charset=utf-8"));

    const result = await verifyAudioUrl(URL);

    expect(result).toEqual({
      ok: false,
      error: "audio_url_not_audio",
      message: "audio_url answered 200 with content type text/html",
    });
  });

  it("reports audio_url_not_audio when no content type comes back", async () => {
    fetchMock.mockResolvedValueOnce(response(200));

    const result = await verifyAudioUrl(URL);

    expect(result).toEqual({
      ok: false,
      error: "audio_url_not_audio",
      message: "audio_url answered 200 with no content type",
    });
  });

  it("cancels the body of the ranged GET so nothing streams", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const res = response(206, "audio/flac");
    (res as { body: unknown }).body = { cancel };
    fetchMock.mockResolvedValueOnce(response(403)).mockResolvedValueOnce(res);

    await verifyAudioUrl(URL);

    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

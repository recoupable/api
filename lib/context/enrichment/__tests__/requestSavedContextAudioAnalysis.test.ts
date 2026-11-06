import { describe, expect, it, vi } from "vitest";
import { requestSavedContextAudioAnalysis } from "../requestSavedContextAudioAnalysis";
const asset = {
  storage: { bucket: "user-files" as const, key: "owner/context-audio/test.wav" },
  sha256: "a".repeat(64),
  durationSeconds: 152,
};
function setup() {
  return {
    verifyFile: vi.fn().mockResolvedValue({ sha256: asset.sha256, durationSeconds: 152.05 }),
    sign: vi.fn().mockResolvedValue("https://private.example/audio?secret=x"),
    fetcher: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "success", response: "text" }),
    }),
  };
}
const body = (audio_url: string) => ({ audio_url, preset: "catalog_metadata" as const });
describe("requestSavedContextAudioAnalysis", () => {
  it("verifies the bytes, signs a 15-minute URL and posts once to the production endpoint", async () => {
    const deps = setup();
    const result = await requestSavedContextAudioAnalysis(asset, body, "api-key", deps);
    expect(deps.verifyFile).toHaveBeenCalledWith(asset.storage.key);
    expect(deps.sign).toHaveBeenCalledWith({ key: asset.storage.key, expiresInSeconds: 900 });
    expect(deps.fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = deps.fetcher.mock.calls[0];
    expect(url).toBe("https://api.recoupable.dev/api/songs/analyze");
    expect(init).toMatchObject({
      method: "POST",
      headers: { "x-api-key": "api-key", "Content-Type": "application/json" },
      redirect: "error",
    });
    expect(JSON.parse(init.body)).toEqual({
      audio_url: "https://private.example/audio?secret=x",
      preset: "catalog_metadata",
    });
    expect(result.responseBody).toEqual({ status: "success", response: "text" });
    expect(result.startedAt).toEqual(expect.any(Number));
  });
  it("rejects changed bytes or duration before signing or paying", async () => {
    for (const file of [
      { sha256: "b".repeat(64), durationSeconds: 152 },
      { sha256: asset.sha256, durationSeconds: 152.2 },
    ]) {
      const deps = setup();
      deps.verifyFile.mockResolvedValue(file);
      await expect(requestSavedContextAudioAnalysis(asset, body, "k", deps)).rejects.toThrow(
        "Saved audio changed",
      );
      expect(deps.sign).not.toHaveBeenCalled();
      expect(deps.fetcher).not.toHaveBeenCalled();
    }
  });
  it("uses an injected analyze dependency instead of the HTTP endpoint", async () => {
    const deps = setup();
    const analyze = vi.fn().mockResolvedValue({ status: "success", response: {} });
    const result = await requestSavedContextAudioAnalysis(asset, body, "", { ...deps, analyze });
    expect(analyze).toHaveBeenCalledWith({
      audio_url: "https://private.example/audio?secret=x",
      preset: "catalog_metadata",
    });
    expect(deps.fetcher).not.toHaveBeenCalled();
    expect(result.responseBody).toEqual({ status: "success", response: {} });
  });
  it("throws on a non-OK provider response", async () => {
    const deps = setup();
    deps.fetcher.mockResolvedValue({ ok: false, status: 402, json: async () => ({}) });
    await expect(requestSavedContextAudioAnalysis(asset, body, "k", deps)).rejects.toThrow(
      "Music Flamingo failed HTTP 402",
    );
  });
});

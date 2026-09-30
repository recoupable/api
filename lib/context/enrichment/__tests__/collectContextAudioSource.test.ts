import { expect, it, vi } from "vitest";
import { collectContextAudioSource } from "../collectContextAudioSource";
const owner = "11111111-1111-4111-8111-111111111111";
const input = {
  recordingSubjectId: owner,
  isrc: "USAT22103065",
  spotifyUrl: "https://open.spotify.com/track/2zpWJxfuyxqCYhpsAqH7Uh",
  youtubeUrl: "https://www.youtube.com/watch?v=YlV6qsP-J1c",
  storageKey: `${owner}/context-audio/recording.wav`,
  sha256: "a".repeat(64),
  durationSeconds: 152.23,
  spotifyDurationSeconds: 152.148,
  verification: {
    method: "waveform-cross-correlation" as const,
    correlation: 0.986,
    previewSeconds: 29.713,
    offsetSeconds: 96.064,
  },
};
function dependencies() {
  return {
    authorize: vi.fn(),
    resolveRecording: vi.fn().mockResolvedValue(input.isrc),
    verifyFile: vi
      .fn()
      .mockResolvedValue({ sha256: input.sha256, durationSeconds: 152.23, bytes: 4871404 }),
    rpc: vi
      .fn()
      .mockResolvedValueOnce({ state: "claimed", attemptId: owner })
      .mockResolvedValue({ state: "saved" }),
  };
}
it("saves a verified private artifact without a signed URL", async () => {
  const deps = dependencies();
  await collectContextAudioSource(owner, owner, owner, input, deps);
  expect(deps.verifyFile).toHaveBeenCalledWith(input.storageKey);
  const result = deps.rpc.mock.calls[1][1].p_result;
  expect(result.content.storage).toEqual({ bucket: "user-files", key: input.storageKey });
  expect(result.content.rightsVerified).toBe(false);
  expect(JSON.stringify(result)).not.toContain("signedUrl");
});
it("rejects foreign storage, mismatched recording, weak overlap, and truncated audio", async () => {
  for (const change of [
    { storageKey: `other/context-audio/file.wav` },
    { verification: { ...input.verification, correlation: 0.2 } },
    { durationSeconds: 30 },
  ]) {
    const deps = dependencies();
    await expect(
      collectContextAudioSource(owner, owner, owner, { ...input, ...change }, deps),
    ).rejects.toThrow();
    expect(deps.rpc).not.toHaveBeenCalled();
  }
  const deps = dependencies();
  deps.resolveRecording.mockResolvedValue("USAT22103066");
  await expect(collectContextAudioSource(owner, owner, owner, input, deps)).rejects.toThrow();
  expect(deps.rpc).not.toHaveBeenCalled();
});
it("does not accept missing or changed stored bytes", async () => {
  const deps = dependencies();
  deps.verifyFile.mockResolvedValue({ sha256: "b".repeat(64), durationSeconds: 152.23, bytes: 10 });
  await expect(collectContextAudioSource(owner, owner, owner, input, deps)).rejects.toThrow();
  expect(deps.rpc.mock.calls.at(-1)?.[0]).toBe("fail_context_enrichment");
});
it("reuses accepted evidence without downloading again", async () => {
  const deps = dependencies();
  deps.rpc.mockReset().mockResolvedValue({ state: "reused" });
  await collectContextAudioSource(owner, owner, owner, input, deps);
  expect(deps.verifyFile).not.toHaveBeenCalled();
});

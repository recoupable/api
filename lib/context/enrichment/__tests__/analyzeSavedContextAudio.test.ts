import { it, expect, vi } from "vitest";
import { analyzeSavedContextAudio } from "../analyzeSavedContextAudio";
const id = "11111111-1111-4111-8111-111111111111";
const asset = {
  storage: { bucket: "user-files", key: `${id}/context-audio/test.wav` },
  sha256: "a".repeat(64),
  durationSeconds: 152,
  youtubeUrl: "https://www.youtube.com/watch?v=YlV6qsP-J1c",
};
function setup() {
  return {
    authorize: vi.fn(),
    rpc: vi.fn(async (name: string, ..._params: Record<string, any>[]) =>
      name === "read_context_documents"
        ? [
            {
              topic: "audio_source",
              status: "accepted",
              subjectId: id,
              resultId: id,
              text: JSON.stringify(asset),
            },
          ]
        : name === "claim_context_enrichment"
          ? { state: "claimed", attemptId: id }
          : { state: "saved" },
    ),
    verifyFile: vi.fn().mockResolvedValue({ sha256: asset.sha256, durationSeconds: 152 }),
    sign: vi.fn().mockResolvedValue("https://private.example/audio?secret=x"),
    fetcher: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "success",
        response: "{'musical_summary': 'Processed vocals', 'lyrical_themes': 'conflict'}",
      }),
    }),
    normalize: vi.fn().mockResolvedValue({
      content: {
        musicalSummary: "Processed vocals",
        lyricalThemes: "Relationship conflict",
        uncertainties: ["Interpretation"],
      },
      trace: { model: "extractor" },
    }),
  };
}
it("handles non-JSON Flamingo text through extraction and saves without signed URL", async () => {
  const deps = setup();
  await analyzeSavedContextAudio(id, id, id, id, "key", deps);
  expect(deps.normalize.mock.calls[0][0].input).toHaveProperty("response");
  expect(deps.rpc).toHaveBeenCalledWith("complete_context_enrichment", expect.anything());
  expect(JSON.stringify(deps.rpc.mock.calls)).not.toContain("secret=x");
});
it("reuses accepted analysis without provider, extraction or signing calls", async () => {
  const deps = setup();
  const rpc = deps.rpc;
  deps.rpc = vi.fn(async (name: string, ..._params: Record<string, any>[]) =>
    name === "claim_context_enrichment" ? { state: "reused" } : rpc(name),
  );
  await analyzeSavedContextAudio(id, id, id, id, "key", deps);
  expect(deps.fetcher).not.toHaveBeenCalled();
  expect(deps.normalize).not.toHaveBeenCalled();
  expect(deps.sign).not.toHaveBeenCalled();
});
it("rejects altered private audio before paying", async () => {
  const deps = setup();
  deps.verifyFile.mockResolvedValue({ sha256: "b".repeat(64), durationSeconds: 152 });
  await expect(analyzeSavedContextAudio(id, id, id, id, "key", deps)).rejects.toThrow();
  expect(deps.fetcher).not.toHaveBeenCalled();
});

it("calls the lyric preset and saves text separately without normalization", async () => {
  const deps = setup();
  deps.fetcher.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ status: "success", response: "[Verse]\nSynthetic test words" }),
  });
  await analyzeSavedContextAudio(id, id, id, id, "key", deps, "lyrics");
  const request = JSON.parse(deps.fetcher.mock.calls[0][1].body);
  expect(request.preset).toBe("lyric_transcription");
  expect(request).not.toHaveProperty("prompt");
  expect(deps.normalize).not.toHaveBeenCalled();
  const claim = deps.rpc.mock.calls.find(c => c[0] === "claim_context_enrichment");
  expect(claim?.[1].p_module.topic).toBe("lyrics");
  const complete = deps.rpc.mock.calls.find(c => c[0] === "complete_context_enrichment");
  expect(complete?.[1].p_result.content.transcription).toBe("[Verse]\nSynthetic test words");
  expect(complete?.[1].p_result.content.transcriptionStatus).toBe("machine-generated; unverified");
  expect(JSON.stringify(deps.rpc.mock.calls)).not.toContain("secret=x");
});

it.each([true, false])(
  "uses only lyrics from the same audio artifact (matching: %s)",
  async matching => {
    const deps = setup();
    const rpc = deps.rpc;
    deps.rpc = vi.fn(async (name: string, ...params: Record<string, any>[]) => {
      const result = await rpc(name, ...params);
      return name === "read_context_documents"
        ? [
            ...(result as any[]),
            {
              topic: "lyrics",
              status: "accepted",
              subjectId: id,
              resultId: id,
              text: JSON.stringify({
                transcription: "Synthetic test transcript",
                audioSha256: matching ? asset.sha256 : "b".repeat(64),
              }),
            },
          ]
        : result;
    });
    const analyze = vi.fn().mockResolvedValue({ status: "success", response: "Processed vocals" });
    await analyzeSavedContextAudio(id, id, id, id, "", { ...deps, analyze });
    expect(analyze).toHaveBeenCalledOnce();
    expect(deps.fetcher).not.toHaveBeenCalled();
    expect(deps.normalize.mock.calls[0][0].input.unverifiedTranscript).toBe(
      matching ? "Synthetic test transcript" : undefined,
    );
    const complete = deps.rpc.mock.calls.find(c => c[0] === "complete_context_enrichment");
    expect(complete?.[1].p_result.content.lyricResultId).toBe(matching ? id : null);
  },
);

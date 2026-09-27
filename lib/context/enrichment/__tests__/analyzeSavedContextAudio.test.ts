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
    rpc: vi.fn(async (name: string) =>
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
  deps.rpc = vi.fn(async (name: string) =>
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

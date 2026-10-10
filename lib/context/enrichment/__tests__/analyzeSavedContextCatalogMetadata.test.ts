import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { analyzeSavedContextCatalogMetadata } from "../analyzeSavedContextCatalogMetadata";
import { ContextStructuredOutputInvalid } from "../ContextStructuredOutputInvalid";
import { getPreset } from "@/lib/flamingo/presets/getPreset";
const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const asset = {
  storage: { bucket: "user-files", key: `${id}/context-audio/test.wav` },
  sha256: "a".repeat(64),
  durationSeconds: 152,
  youtubeUrl: "https://www.youtube.com/watch?v=YlV6qsP-J1c",
  verification: {
    method: "waveform-cross-correlation",
    correlation: 0.986,
    previewSeconds: 29.713,
    offsetSeconds: 96.064,
  },
};
const metadata = { genre: "Pop", tempo_bpm: 120, mood: ["bright"], instruments: ["synth"] };
function setup(response: unknown = metadata) {
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
        preset: "catalog_metadata",
        response,
        elapsed_seconds: 12.5,
      }),
    }),
  };
}
function call(deps: ReturnType<typeof setup>, subject = id) {
  return analyzeSavedContextCatalogMetadata(id, id, id, subject, "secret-api-key", deps);
}
describe("analyzeSavedContextCatalogMetadata", () => {
  it("sends the catalog_metadata preset without a prompt and saves validated metadata", async () => {
    const deps = setup();
    await call(deps);
    const request = JSON.parse(deps.fetcher.mock.calls[0][1].body);
    expect(request).toEqual({
      audio_url: "https://private.example/audio?secret=x",
      preset: "catalog_metadata",
    });
    const claim = deps.rpc.mock.calls.find(c => c[0] === "claim_context_enrichment");
    expect(claim?.[1].p_module).toMatchObject({
      key: "saved-audio-catalog-metadata-v1",
      topic: "catalog_metadata",
      subjectId: id,
      provider: "recoup-production",
      model: "nvidia/music-flamingo-2601-hf",
      input: {
        audioSourceResultId: id,
        sha256: asset.sha256,
        preset: "catalog_metadata",
        presetVersion: createHash("sha256")
          .update(
            JSON.stringify([
              getPreset("catalog_metadata")!.prompt,
              getPreset("catalog_metadata")!.params,
            ]),
          )
          .digest("hex"),
        normalization: "catalog-metadata-json-v1",
      },
    });
    const complete = deps.rpc.mock.calls.find(c => c[0] === "complete_context_enrichment");
    const result = complete?.[1].p_result;
    expect(result.coverage).toBe("full");
    expect(result.content).toMatchObject({
      schemaVersion: 1,
      metadata,
      metadataStatus: "model interpretation; not independently verified",
      audioSourceResultId: id,
      audioSha256: asset.sha256,
      durationSeconds: 152,
      inputScope: "complete saved WAV",
      coverageLabel: "full",
      coverage: { extent: "full", identity: "matched", startSeconds: 0, endSeconds: 152 },
    });
  });
  it("records the local preset prompt, params, media manifest and validation in the trace", async () => {
    const deps = setup();
    await call(deps);
    const complete = deps.rpc.mock.calls.find(c => c[0] === "complete_context_enrichment");
    const preset = getPreset("catalog_metadata")!;
    expect(complete?.[1].p_result.trace).toMatchObject({
      preset: { name: "catalog_metadata", prompt: preset.prompt, params: preset.params },
      media: [{ coverage: "full", startSeconds: 0, endSeconds: 152, sha256: asset.sha256 }],
      rawResponse: {
        status: "success",
        preset: "catalog_metadata",
        response: metadata,
        elapsed_seconds: 12.5,
      },
      validation: { status: "valid" },
    });
    expect(complete?.[1].p_result.trace.elapsedMs).toEqual(expect.any(Number));
  });
  it("never writes the signed URL or API key into any rpc payload", async () => {
    const deps = setup();
    await call(deps);
    const payloads = JSON.stringify(deps.rpc.mock.calls);
    expect(payloads).not.toContain("secret=x");
    expect(payloads).not.toContain("secret-api-key");
    expect(payloads).not.toContain("private.example");
  });
  it("parses a Python-style dict string returned when production did not parse it", async () => {
    const deps = setup("{'genre': 'House', 'tempo_bpm': 124}");
    await call(deps);
    const complete = deps.rpc.mock.calls.find(c => c[0] === "complete_context_enrichment");
    expect(complete?.[1].p_result.content.metadata).toEqual({ genre: "House", tempo_bpm: 124 });
  });
  it("fails the attempt on invalid structured output and never completes it", async () => {
    const deps = setup("The track is an upbeat pop song.");
    await expect(call(deps)).rejects.toBeInstanceOf(ContextStructuredOutputInvalid);
    expect(deps.rpc).toHaveBeenCalledWith("fail_context_enrichment", {
      p_owner: id,
      p_attempt: id,
    });
    expect(deps.rpc).not.toHaveBeenCalledWith("complete_context_enrichment", expect.anything());
  });
  it("reuses a compatible accepted result without provider, signing or verification calls", async () => {
    const deps = setup();
    const rpc = deps.rpc;
    deps.rpc = vi.fn(async (name: string, ...params: Record<string, any>[]) =>
      name === "claim_context_enrichment" ? { state: "reused" } : rpc(name, ...params),
    );
    const receipt = await call(deps);
    expect(receipt).toEqual({ state: "reused" });
    expect(deps.fetcher).not.toHaveBeenCalled();
    expect(deps.sign).not.toHaveBeenCalled();
    expect(deps.verifyFile).not.toHaveBeenCalled();
  });
  it("rejects altered private audio before paying", async () => {
    const deps = setup();
    deps.verifyFile.mockResolvedValue({ sha256: "b".repeat(64), durationSeconds: 152 });
    await expect(call(deps)).rejects.toThrow("Saved audio changed");
    expect(deps.fetcher).not.toHaveBeenCalled();
    expect(deps.sign).not.toHaveBeenCalled();
    expect(deps.rpc.mock.calls.at(-1)?.[0]).toBe("fail_context_enrichment");
  });
  it("throws without claiming when the subject has no accepted audio source", async () => {
    const deps = setup();
    await expect(call(deps, other)).rejects.toThrow("No accepted audio source");
    expect(deps.rpc).not.toHaveBeenCalledWith("claim_context_enrichment", expect.anything());
    expect(deps.fetcher).not.toHaveBeenCalled();
  });
  it("refuses unverified saved audio before claiming or paying", async () => {
    const deps = setup();
    const { verification: _verification, ...unverified } = asset;
    deps.rpc.mockImplementation(async (name: string) =>
      name === "read_context_documents"
        ? [
            {
              topic: "audio_source",
              status: "accepted",
              subjectId: id,
              resultId: id,
              text: JSON.stringify(unverified),
            },
          ]
        : { state: "claimed", attemptId: id },
    );
    await expect(call(deps)).rejects.toThrow("(unverified)");
    expect(deps.rpc).not.toHaveBeenCalledWith("claim_context_enrichment", expect.anything());
    expect(deps.fetcher).not.toHaveBeenCalled();
  });
  it("uses an injected analyze dependency instead of the fetcher", async () => {
    const deps = setup();
    const analyze = vi.fn().mockResolvedValue({ status: "success", response: metadata });
    await analyzeSavedContextCatalogMetadata(id, id, id, id, "", { ...deps, analyze });
    expect(analyze).toHaveBeenCalledWith({
      audio_url: "https://private.example/audio?secret=x",
      preset: "catalog_metadata",
    });
    expect(deps.fetcher).not.toHaveBeenCalled();
  });
});

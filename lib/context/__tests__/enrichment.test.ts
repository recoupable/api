import { describe, expect, it, vi } from "vitest";
import { runContextEnrichment } from "../enrichment/runContextEnrichment";
const module = {
  key: "lyrics-v1",
  topic: "lyrics",
  subjectId: "song",
  provider: "recoup",
  model: "music-flamingo",
  input: { audioUrl: "https://p.scdn.co/clip.mp3" },
  sources: [{ url: "https://p.scdn.co/clip.mp3", kind: "audio", content: { coverage: "preview" } }],
};
describe("independent paid context modules", () => {
  it("checks authorization before provider and save; persists exact output", async () => {
    const authorize = vi.fn(async () => undefined);
    const call = vi.fn(async () => ({
      content: { transcript: "clip text" },
      coverage: "partial" as const,
      trace: { prompt: "transcribe" },
      costUsd: 0.1,
      costStatus: "estimated" as const,
    }));
    const rpc = vi.fn(async (name: string) =>
      name === "claim_context_enrichment"
        ? { state: "claimed", attemptId: "attempt" }
        : { saved: true },
    );
    await runContextEnrichment("actor", "owner", "request", module, { authorize, rpc, call });
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      "complete_context_enrichment",
      expect.objectContaining({
        p_attempt: "attempt",
        p_result: expect.objectContaining({ coverage: "partial" }),
      }),
    );
  });
  it("reuses accepted work without charging again", async () => {
    const call = vi.fn();
    const result = await runContextEnrichment("actor", "owner", "request", module, {
      authorize: vi.fn(),
      rpc: vi.fn(async () => ({ state: "reused" })),
      call,
    });
    expect(result).toMatchObject({ state: "reused" });
    expect(call).not.toHaveBeenCalled();
  });
  it("does not repeat an ambiguous in-flight paid call", async () => {
    const call = vi.fn();
    await expect(
      runContextEnrichment("actor", "owner", "request", module, {
        authorize: vi.fn(),
        rpc: vi.fn(async () => ({ state: "unknown" })),
        call,
      }),
    ).rejects.toThrow("reconciliation");
    expect(call).not.toHaveBeenCalled();
  });
  it("records failed attempts and rethrows", async () => {
    const rpc = vi.fn(async (name: string) =>
      name === "claim_context_enrichment" ? { state: "claimed", attemptId: "attempt" } : true,
    );
    await expect(
      runContextEnrichment("actor", "owner", "request", module, {
        authorize: vi.fn(),
        rpc,
        call: vi.fn(async () => {
          throw new Error("provider failed");
        }),
      }),
    ).rejects.toThrow("provider failed");
    expect(rpc).toHaveBeenCalledWith(
      "fail_context_enrichment",
      expect.objectContaining({ p_attempt: "attempt" }),
    );
  });
});

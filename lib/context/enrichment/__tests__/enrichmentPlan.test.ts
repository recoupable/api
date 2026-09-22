import { lookupMusicBrainzIsrc } from "../../providers/lookupMusicBrainzIsrc";
import { describe, expect, it, vi } from "vitest";
import type { ContextEnrichmentResult } from "../runContextEnrichment";
import { runContextEnrichmentPlan } from "../runContextEnrichmentPlan";
const moduleFor = (key: string) => ({
  key,
  topic: key,
  subjectId: "song",
  provider: "fixture",
  model: "none",
  input: {},
  sources: [],
});
const node = (key: string, dependsOn: string[] = []) => ({
  key,
  dependsOn,
  prepare: vi.fn(async () => moduleFor(key)),
});
function deps() {
  return {
    authorize: vi.fn(async () => undefined),
    rpc: vi.fn(
      async (name: string, args: Record<string, unknown>): Promise<unknown> =>
        name === "claim_context_enrichment"
          ? { state: "claimed", attemptId: (args.p_module as { key: string }).key }
          : { saved: true },
    ),
    call: vi.fn(
      async (): Promise<ContextEnrichmentResult> => ({
        content: { value: "fixture" },
        coverage: "partial" as const,
        trace: { fixture: true },
        costUsd: null,
        costStatus: "unknown" as const,
      }),
    ),
  };
}
describe("enrichment dependency plan", () => {
  it("runs independent modules together, then prepares dependents from persisted receipts", async () => {
    const d = deps();
    const starts: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>(r => {
      release = r;
    });
    d.call.mockImplementation(async (m?: ReturnType<typeof moduleFor>) => {
      starts.push(m!.key);
      if (starts.length === 2) release();
      await gate;
      return { content: {}, coverage: "partial", trace: {}, costUsd: null, costStatus: "unknown" };
    });
    const summary = node("summary", ["lyrics", "metadata"]);
    const result = await runContextEnrichmentPlan(
      "actor",
      "owner",
      "request",
      [node("lyrics"), node("metadata"), summary],
      d,
      2,
    );
    expect(starts.slice(0, 2)).toEqual(["lyrics", "metadata"]);
    expect(summary.prepare).toHaveBeenCalledWith({
      lyrics: { saved: true },
      metadata: { saved: true },
    });
    expect(result.map(r => r.status)).toEqual(["saved", "saved", "saved"]);
  });
  it("blocks descendants of failures but still completes unrelated work", async () => {
    const d = deps();
    d.call.mockRejectedValueOnce(new Error("provider failed"));
    const summary = node("summary", ["lyrics"]),
      final = node("final", ["summary"]);
    const result = await runContextEnrichmentPlan(
      "actor",
      "owner",
      "request",
      [node("lyrics"), node("artist"), summary, final],
      d,
    );
    expect(result.map(r => r.status)).toEqual(["failed", "saved", "blocked", "blocked"]);
    expect(summary.prepare).not.toHaveBeenCalled();
    expect(final.prepare).not.toHaveBeenCalled();
  });
  it("rejects cycles, missing dependencies and duplicate keys before any side effects", async () => {
    for (const plan of [
      [node("a", ["b"]), node("b", ["a"])],
      [node("a", ["missing"])],
      [node("a"), node("a")],
    ]) {
      const d = deps();
      await expect(runContextEnrichmentPlan("a", "o", "r", plan, d)).rejects.toThrow();
      expect(d.authorize).not.toHaveBeenCalled();
      expect(d.rpc).not.toHaveBeenCalled();
    }
  });
  it("authorizes before preparing input and retains reused receipts without provider calls", async () => {
    const d = deps(),
      n = node("a");
    d.authorize.mockRejectedValueOnce(new Error("denied"));
    await expect(runContextEnrichmentPlan("a", "o", "r", [n], d)).rejects.toThrow("denied");
    expect(n.prepare).not.toHaveBeenCalled();
    d.rpc.mockResolvedValue({ state: "reused" });
    const result = await runContextEnrichmentPlan("a", "o", "r", [n], d);
    expect(result[0].status).toBe("reused");
    expect(d.call).not.toHaveBeenCalled();
  });
  it("enforces the concurrency bound and rejects mismatched prepared keys", async () => {
    const d = deps();
    let active = 0,
      max = 0;
    d.call.mockImplementation(async () => {
      active++;
      max = Math.max(max, active);
      await new Promise(r => setTimeout(r, 5));
      active--;
      return { content: {}, coverage: "partial", trace: {}, costUsd: null, costStatus: "unknown" };
    });
    const wrong = { ...node("wrong"), prepare: async () => moduleFor("different") };
    const result = await runContextEnrichmentPlan(
      "a",
      "o",
      "r",
      [node("a"), node("b"), node("c"), wrong],
      d,
      2,
    );
    expect(max).toBe(2);
    expect(result[3].status).toBe("failed");
    expect(d.call).toHaveBeenCalledTimes(3);
  });
  it("hands a provider source gap to persistence without pretending it found context", async () => {
    const d = deps();
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }));
    d.call.mockImplementation(async () => {
      const result = await lookupMusicBrainzIsrc("USAT22103065", async () => undefined, fetcher);
      return {
        content: result,
        coverage: "unknown",
        trace: result.trace,
        costUsd: null,
        costStatus: "unknown",
      };
    });
    const results = await runContextEnrichmentPlan(
      "actor",
      "owner",
      "request",
      [node("musicbrainz")],
      d,
    );
    expect(results[0].status).toBe("saved");
    expect(d.rpc).toHaveBeenCalledWith(
      "complete_context_enrichment",
      expect.objectContaining({
        p_result: expect.objectContaining({
          coverage: "unknown",
          content: expect.objectContaining({ status: "not_found" }),
        }),
      }),
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

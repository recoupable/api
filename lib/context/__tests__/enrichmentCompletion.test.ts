import { expect, it, vi } from "vitest";
import { runContextEnrichment } from "../enrichment/runContextEnrichment";
import { ContextNodeNeedsReconciliation } from "../planning/ContextNodeNeedsReconciliation";
import { runPlannedContextModules } from "../planning/runPlannedContextModules";

const module = {
  key: "fixture-v1",
  topic: "release",
  subjectId: "release",
  provider: "fixture",
  model: "none",
  input: {},
  sources: [{ url: "https://example.com/release", kind: "provider_metadata", content: {} }],
};
const result = {
  content: { title: "Fixture" },
  coverage: "partial" as const,
  trace: {},
  costUsd: null,
  costStatus: "unknown" as const,
};

it.each([false, true])(
  "stops scheduling on a lost save acknowledgement even when uncertainty marking fails: %s",
  async markingFails => {
    const call = vi.fn(async () => result);
    const rpc = vi.fn(async (name: string) => {
      if (name === "claim_context_enrichment") return { state: "claimed", attemptId: "attempt" };
      if (name === "complete_context_enrichment") throw new Error("Lost save response");
      if (name === "fail_context_enrichment" && markingFails)
        throw new Error("Database unavailable");
      return true;
    });
    const dispatch = vi.fn(
      async () =>
        (await runContextEnrichment("actor", "owner", "request", module, {
          authorize: vi.fn(),
          rpc,
          call,
        })) as { state: string },
    );
    const persistOutcome = vi.fn();
    await expect(
      runPlannedContextModules(
        [
          { key: "release", dependsOn: [], state: "ready_for_dispatch" },
          { key: "brief", dependsOn: ["release"], state: "ready_for_dispatch" },
        ],
        { authorize: vi.fn(), dispatch, persistOutcome },
      ),
    ).rejects.toBeInstanceOf(ContextNodeNeedsReconciliation);
    expect(call).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledOnce();
    expect(persistOutcome).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "claim_context_enrichment",
      "complete_context_enrichment",
      "fail_context_enrichment",
    ]);
  },
);

it("returns the saved receipt unchanged when completion is acknowledged", async () => {
  const receipt = { state: "saved", resultId: "result" };
  const rpc = vi.fn(async (name: string) =>
    name === "claim_context_enrichment" ? { state: "claimed", attemptId: "attempt" } : receipt,
  );
  await expect(
    runContextEnrichment("actor", "owner", "request", module, {
      authorize: vi.fn(),
      rpc,
      call: async () => result,
    }),
  ).resolves.toBe(receipt);
  expect(rpc.mock.calls.map(([name]) => name)).not.toContain("fail_context_enrichment");
});

import { expect, it, vi } from "vitest";
import { runContextEnrichmentPlan } from "../runContextEnrichmentPlan";

it("drains in-flight work and stops the enrichment plan after an uncertain save", async () => {
  const saveError = new Error("Private database diagnostic");
  let finishIndependent!: () => void;
  const gate = new Promise<void>(resolve => {
    finishIndependent = resolve;
  });
  const node = (key: string, dependsOn: string[] = []) => ({
    key,
    dependsOn,
    prepare: vi.fn(async () => ({
      key,
      topic: key,
      subjectId: key,
      provider: "fixture",
      model: "none",
      input: {},
      sources: [],
    })),
  });
  const release = node("release"),
    independent = node("independent");
  const brief = node("brief", ["release"]),
    waiting = node("waiting");
  const call = vi.fn(async (module: { key: string }) => {
    if (module.key === "independent") await gate;
    return {
      content: {},
      coverage: "partial" as const,
      trace: {},
      costUsd: null,
      costStatus: "unknown" as const,
    };
  });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "claim_context_enrichment")
      return { state: "claimed", attemptId: (args.p_module as { key: string }).key };
    if (name === "complete_context_enrichment" && args.p_attempt === "release") throw saveError;
    return { state: "saved" };
  });
  let finished = false;
  const run = runContextEnrichmentPlan(
    "actor",
    "owner",
    "request",
    [release, independent, brief, waiting],
    { authorize: vi.fn(), call, rpc },
    2,
  );
  const checked = expect(run)
    .rejects.toMatchObject({
      name: "ContextNodeNeedsReconciliation",
      message: "Context node requires reconciliation before another provider call",
      cause: saveError,
    })
    .then(() => {
      finished = true;
    });
  await vi.waitFor(() =>
    expect(rpc).toHaveBeenCalledWith(
      "fail_context_enrichment",
      expect.objectContaining({ p_attempt: "release" }),
    ),
  );
  expect(finished).toBe(false);
  expect(brief.prepare).not.toHaveBeenCalled();
  expect(waiting.prepare).not.toHaveBeenCalled();
  finishIndependent();
  await checked;
  expect(call).toHaveBeenCalledTimes(2);
  expect(brief.prepare).not.toHaveBeenCalled();
  expect(waiting.prepare).not.toHaveBeenCalled();
});

import { expect, it, vi } from "vitest";
import { runContextEnrichment } from "../enrichment/runContextEnrichment";
import { ContextNodeNeedsReconciliation } from "../planning/ContextNodeNeedsReconciliation";
import { runPlannedContextModules } from "../planning/runPlannedContextModules";

it.each(["unknown", "lost acknowledgement"])(
  "keeps an uncertain enrichment claim out of failed execution outcomes: %s",
  async state => {
    const rpc = vi.fn(async () => {
      if (state === "lost acknowledgement") throw new Error("Claim response lost");
      return { state };
    });
    const call = vi.fn();
    const persistOutcome = vi.fn();
    await expect(
      runPlannedContextModules([{ key: "release", dependsOn: [], state: "ready_for_dispatch" }], {
        authorize: vi.fn(),
        dispatch: async () =>
          (await runContextEnrichment(
            "actor",
            "owner",
            "request",
            {
              key: "fixture-v1",
              topic: "release",
              subjectId: "release",
              provider: "fixture",
              model: "none",
              input: {},
              sources: [],
            },
            { authorize: vi.fn(), rpc, call },
          )) as { state: string },
        persistOutcome,
      }),
    ).rejects.toBeInstanceOf(ContextNodeNeedsReconciliation);
    expect(call).not.toHaveBeenCalled();
    expect(persistOutcome).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledOnce();
  },
);

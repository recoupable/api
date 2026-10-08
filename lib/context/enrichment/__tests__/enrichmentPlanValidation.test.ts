import { expect, it, vi } from "vitest";
import { runContextEnrichmentPlan } from "../runContextEnrichmentPlan";
import type { PlanNode } from "../enrichmentPlanTypes";

it.each([undefined, null, "not a function"])(
  "rejects a malformed prepare callback before any work: %s",
  async prepare => {
    const deps = { authorize: vi.fn(), call: vi.fn(), rpc: vi.fn() };
    const validPrepare = vi.fn();
    const plan = [
      { key: "valid", dependsOn: [], prepare: validPrepare },
      { key: "invalid", dependsOn: [], prepare },
    ] as unknown as PlanNode[];
    await expect(
      runContextEnrichmentPlan("actor", "owner", "request", plan, deps),
    ).rejects.toThrow();
    expect(deps.authorize).not.toHaveBeenCalled();
    expect(validPrepare).not.toHaveBeenCalled();
    expect(deps.call).not.toHaveBeenCalled();
    expect(deps.rpc).not.toHaveBeenCalled();
  },
);

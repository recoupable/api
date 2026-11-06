import { SiteError } from "../SiteError";
import { FatalError } from "workflow";
import { expect, it, vi } from "vitest";
import { initializeBuildStep } from "@/app/workflows/sites/initializeBuildStep";
import { initializeSiteBuild } from "../builder/initializeSiteBuild";
import { prepareBuildInput } from "../production/prepareBuildInput";
vi.mock("../builder/initializeSiteBuild", () => ({ initializeSiteBuild: vi.fn() }));
vi.mock("../production/prepareBuildInput", () => ({
  prepareBuildInput: vi.fn(() => ({ site: {}, instruction: "repair" })),
}));
vi.mock("workflow", () => ({ FatalError: class extends Error {} }));
it("preserves a retryable initialization error instead of making it fatal", async () => {
  const error = new Error("temporary provider failure");
  vi.mocked(initializeSiteBuild).mockRejectedValueOnce(error);
  await expect(
    initializeBuildStep(...([] as unknown as Parameters<typeof prepareBuildInput>)),
  ).rejects.toBe(error);
});
it("reuses the existing visual world for implementation-only repairs", async () => {
  vi.mocked(initializeSiteBuild).mockResolvedValueOnce({} as never);
  const world = { version: 1 };
  await initializeBuildStep(
    {} as never,
    "",
    {} as never,
    [],
    "account",
    { brandWorld: world } as never,
    { verdict: "revise", issues: [{ module: "implementation" }] } as never,
  );
  expect(initializeSiteBuild).toHaveBeenLastCalledWith({}, "repair", "account", world);
});
it("regenerates art direction when the review requests asset changes", async () => {
  vi.mocked(initializeSiteBuild).mockResolvedValueOnce({} as never);
  await initializeBuildStep(
    {} as never,
    "",
    {} as never,
    [],
    "account",
    { brandWorld: { version: 1 } } as never,
    { verdict: "revise", issues: [{ module: "assets" }] } as never,
  );
  expect(initializeSiteBuild).toHaveBeenLastCalledWith({}, "repair", "account", undefined);
});

it("does not retry an exhausted balance", async () => {
  vi.mocked(initializeSiteBuild).mockRejectedValueOnce(new SiteError(402, "Not enough credits"));
  await expect(
    initializeBuildStep(...([] as unknown as Parameters<typeof prepareBuildInput>)),
  ).rejects.toBeInstanceOf(FatalError);
});

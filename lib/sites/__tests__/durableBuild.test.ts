import { expect, it, vi } from "vitest";
import { buildStep } from "@/app/workflows/sites/buildStep";
vi.mock("@/app/workflows/sites/ensureSiteExistsStep", () => ({
  ensureSiteExistsStep: vi.fn().mockResolvedValue(undefined),
}));
const m = vi.hoisted(() => ({ initialize: vi.fn(), turn: vi.fn() }));
vi.mock("@/app/workflows/sites/initializeBuildStep", () => ({ initializeBuildStep: m.initialize }));
vi.mock("@/app/workflows/sites/buildTurnStep", () => ({ buildTurnStep: m.turn }));
it("checkpoints and resumes each model turn without an arbitrary turn-count cutoff", async () => {
  m.initialize.mockResolvedValue({ turns: 0, files: { html: "saved" } });
  m.turn.mockImplementation(async state => ({
    ...state,
    turns: state.turns + 1,
    ...(state.turns === 11 ? { snapshot: { name: "Complete" } } : {}),
  }));
  const result = await buildStep({} as any, "Build", {} as any, [], "account");
  expect(result).toEqual({ name: "Complete" });
  expect(m.turn).toHaveBeenCalledTimes(12);
  expect(m.turn.mock.calls[11][0]).toMatchObject({ turns: 11, files: { html: "saved" } });
});

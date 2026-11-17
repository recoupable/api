import { beforeEach, describe, expect, it, vi } from "vitest";
import { runBoundedSiteRepairs } from "../production/runBoundedSiteRepairs";
import type { SiteSnapshot } from "../schema";
import type { CreativeReview } from "../production/schema";
const snapshot: SiteSnapshot = {
  name: "Original",
  releaseUrl: "",
  assets: [],
  design: {
    headline: "Play",
    eyebrow: "",
    description: "",
    buttonLabel: "Play",
    signupHeading: "Join",
    background: "#000000",
    foreground: "#ffffff",
    accent: "#ffffff",
    layout: "poster",
    font: "sans",
    experience: { html: "<button>Play</button>", css: "", javascript: "void 0" },
  },
};
const failed: CreativeReview = {
  verdict: "revise",
  summary: "Broken",
  issues: [
    { severity: "blocking", module: "implementation", detail: "Dead button", fix: "Wire button" },
  ],
};
const passed: CreativeReview = { verdict: "pass", summary: "Works", issues: [] };
let clock: number;
let revision: number;
let cancelled: boolean;
const repair = vi.fn();
const review = vi.fn();
const run = (limits: unknown = { maxAttempts: 2, deadlineMs: 100 }) =>
  runBoundedSiteRepairs({
    snapshot,
    review: failed,
    baseRevision: 7,
    limits,
    repair,
    reviewCandidate: review,
    readControl: async () => ({ revision, cancelled }),
    now: () => clock,
  });
beforeEach(() => {
  vi.resetAllMocks();
  clock = 0;
  revision = 7;
  cancelled = false;
  repair.mockImplementation(async (candidate: SiteSnapshot) => ({
    ...candidate,
    name: candidate.name + " repaired",
  }));
  review.mockResolvedValue(failed);
});
describe("bounded offline repairs", () => {
  it("stops an endlessly revising candidate at the exact attempt limit without mutating saved inputs", async () => {
    const before = structuredClone(snapshot);
    const result = await run();
    expect(result).toMatchObject({
      status: "stopped",
      reason: "attempts-exhausted",
      attempts: 2,
      baseRevision: 7,
    });
    expect(repair).toHaveBeenCalledTimes(2);
    expect(review).toHaveBeenCalledTimes(2);
    expect(snapshot).toEqual(before);
    expect(result.history).toHaveLength(3);
    expect(new Set(result.history.map(item => item.snapshotSha256)).size).toBe(3);
  });
  it.each([
    undefined,
    {},
    { maxAttempts: -1, deadlineMs: 100 },
    { maxAttempts: 1.5, deadlineMs: 100 },
    { maxAttempts: 2, deadlineMs: Infinity },
    { maxAttempts: 2, deadlineMs: 100, extra: true },
  ])("rejects invalid or absent explicit limits before work: %j", async limits => {
    await expect(
      runBoundedSiteRepairs({
        snapshot,
        review: failed,
        baseRevision: 7,
        limits,
        repair,
        reviewCandidate: review,
        readControl: async () => ({ revision, cancelled }),
        now: () => clock,
      }),
    ).rejects.toThrow();
    expect(repair).not.toHaveBeenCalled();
    expect(review).not.toHaveBeenCalled();
  });
  it("allows an explicit zero repair allowance", async () => {
    expect(await run({ maxAttempts: 0, deadlineMs: 100 })).toMatchObject({
      reason: "attempts-exhausted",
      attempts: 0,
    });
    expect(repair).not.toHaveBeenCalled();
  });
  it("stops when already expired", async () => {
    clock = 100;
    expect(await run()).toMatchObject({ reason: "time-exhausted", attempts: 0 });
    expect(repair).not.toHaveBeenCalled();
  });
  it("starts no review after the repair consumes the remaining time", async () => {
    repair.mockImplementation(async () => {
      clock = 100;
      return snapshot;
    });
    expect(await run()).toMatchObject({ reason: "time-exhausted", attempts: 1 });
    expect(review).not.toHaveBeenCalled();
  });
  it("does not accept a late passing review", async () => {
    review.mockImplementation(async () => {
      clock = 100;
      return passed;
    });
    expect(await run()).toMatchObject({ status: "stopped", reason: "time-exhausted" });
    expect(repair).toHaveBeenCalledOnce();
  });
  it("cancels before any additional work", async () => {
    cancelled = true;
    expect(await run()).toMatchObject({ reason: "cancelled", attempts: 0 });
    expect(repair).not.toHaveBeenCalled();
  });
  it("does not review or repair again after cancellation during repair", async () => {
    repair.mockImplementation(async () => {
      cancelled = true;
      return snapshot;
    });
    expect(await run()).toMatchObject({ reason: "cancelled", attempts: 1 });
    expect(review).not.toHaveBeenCalled();
  });
  it("rejects a revision race even when the new candidate passes", async () => {
    review.mockImplementation(async () => {
      revision = 8;
      return passed;
    });
    expect(await run()).toMatchObject({ status: "stopped", reason: "revision-changed" });
    expect(repair).toHaveBeenCalledOnce();
  });
  it("returns a successful repair with evidence attached to that candidate", async () => {
    review.mockResolvedValue(passed);
    const result = await run();
    expect(result).toMatchObject({
      status: "passed",
      attempts: 1,
      candidate: { name: "Original repaired" },
    });
    expect(result.history.at(-1)?.review).toEqual(passed);
    expect(review).toHaveBeenCalledWith(result.candidate);
  });
  it("does not turn a credit or direction stop into another paid repair", async () => {
    review.mockResolvedValue({ ...failed, blocked: "credits" });
    expect(await run()).toMatchObject({ reason: "review-blocked", attempts: 1 });
    expect(repair).toHaveBeenCalledOnce();
  });
  it("does not permit a nonfinite clock to bypass the deadline", async () => {
    clock = NaN;
    await expect(run()).rejects.toThrow();
    expect(repair).not.toHaveBeenCalled();
  });
});

it("does not accept a passing review after cancellation and retains its exact candidate binding", async () => {
  review.mockImplementation(async () => {
    cancelled = true;
    return passed;
  });
  const result = await run();
  expect(result).toMatchObject({ status: "stopped", reason: "cancelled" });
  expect(result.history.at(-1)?.snapshotSha256).toBe(result.candidateSha256);
  expect(repair).toHaveBeenCalledOnce();
});
it("does not associate an unreviewed repair with previous passing evidence", async () => {
  repair.mockImplementation(async () => {
    cancelled = true;
    return { ...snapshot, name: "Unreviewed" };
  });
  const result = await run();
  expect(result.history.at(-1)?.snapshotSha256).not.toBe(result.candidateSha256);
  expect(result.status).toBe("stopped");
  expect(review).not.toHaveBeenCalled();
});
it("preserves original input even if a repair mutates its input and fails", async () => {
  const before = structuredClone(snapshot);
  repair.mockImplementation(async candidate => {
    candidate.design.experience.html = "mutated";
    throw new Error("Synthetic provider failure");
  });
  await expect(run()).rejects.toThrow("Synthetic provider failure");
  expect(snapshot).toEqual(before);
  expect(review).not.toHaveBeenCalled();
});
it("returns direction failures without beginning repairs", async () => {
  const result = await runBoundedSiteRepairs({
    snapshot,
    review: { ...failed, issues: [{ ...failed.issues[0], module: "direction" }] },
    baseRevision: 7,
    limits: { maxAttempts: 2, deadlineMs: 100 },
    repair,
    reviewCandidate: review,
    readControl: async () => ({ revision, cancelled }),
    now: () => clock,
  });
  expect(result).toMatchObject({ reason: "direction-required", attempts: 0 });
  expect(repair).not.toHaveBeenCalled();
});

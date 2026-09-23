import { expect, it, vi } from "vitest";
import { runPlannedContextModules } from "../runPlannedContextModules";
const node = (key: string, dependsOn: string[] = [], state = "ready_for_dispatch") => ({
  key,
  dependsOn,
  state,
});
const deps = () => ({
  authorize: vi.fn(async () => undefined),
  dispatch: vi.fn(async (_node: { key: string }) => ({ state: "saved" })),
  persistOutcome: vi.fn(async () => undefined),
});
it("runs independent modules concurrently and waits for saved dependencies", async () => {
  const d = deps();
  const started: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  d.dispatch.mockImplementation(async n => {
    started.push(n.key);
    if (n.key === "audio") await gate;
    return { state: "saved" };
  });
  const run = runPlannedContextModules(
    [node("audio"), node("artist"), node("summary", ["audio"])],
    d,
    2,
  );
  await vi.waitFor(() => expect(started).toEqual(["audio", "artist"]));
  expect(started).not.toContain("summary");
  release();
  const results = await run;
  expect(results.map(x => x.status)).toEqual(["saved", "saved", "saved"]);
  expect(d.persistOutcome).toHaveBeenCalledTimes(3);
});
it("blocks dependents of failed collectors but finishes independent work", async () => {
  const d = deps();
  d.dispatch.mockImplementation(async n => {
    if (n.key === "audio") throw new Error("private source details");
    return { state: "saved" };
  });
  const result = await runPlannedContextModules(
    [node("audio"), node("summary", ["audio"]), node("artist")],
    d,
  );
  expect(result.map(x => x.status)).toEqual(["failed", "blocked", "saved"]);
  expect(JSON.stringify(result)).not.toContain("private source details");
  expect(d.dispatch).toHaveBeenCalledTimes(2);
});
it("never dispatches blocked or unimplemented plans, and verifies reuse through the collector", async () => {
  const d = deps();
  d.dispatch.mockResolvedValue({ state: "reused" });
  const result = await runPlannedContextModules(
    [
      node("missing", [], "not_implemented"),
      node("denied", [], "blocked"),
      node("cached", [], "reuse_candidate"),
    ],
    d,
  );
  expect(result.map(x => x.status)).toEqual(["blocked", "blocked", "reused"]);
  expect(d.dispatch).toHaveBeenCalledTimes(1);
  expect(d.authorize).toHaveBeenCalled();
});
it("fails the run on trace persistence failure without dispatching dependent work", async () => {
  const d = deps();
  d.persistOutcome.mockRejectedValue(new Error("storage unavailable"));
  await expect(
    runPlannedContextModules([node("audio"), node("summary", ["audio"])], d, 1),
  ).rejects.toThrow("storage unavailable");
  expect(d.dispatch).toHaveBeenCalledTimes(1);
});
it("rejects duplicate keys, missing dependencies and cycles before dispatch", async () => {
  for (const plan of [
    [node("a"), node("a")],
    [node("a", ["missing"])],
    [node("a", ["b"]), node("b", ["a"])],
  ]) {
    const d = deps();
    await expect(runPlannedContextModules(plan, d)).rejects.toThrow();
    expect(d.dispatch).not.toHaveBeenCalled();
  }
});
it("does not dispatch after authorization fails", async () => {
  const d = deps();
  d.authorize.mockRejectedValue(new Error("revoked"));
  const result = await runPlannedContextModules([node("a")], d);
  expect(result[0].status).toBe("failed");
  expect(d.dispatch).not.toHaveBeenCalled();
});
it("accepts the actual planner output without dispatching modules denied by policy", async () => {
  const { planContextModules } = await import("../planContextModules");
  const subjectId = "00000000-0000-4000-8000-000000000001";
  const plan = planContextModules({
    entry: "song",
    targets: [
      {
        subjectId,
        kind: "recording",
        identityConfirmed: true,
        availableFields: ["isrc"],
        reusableModules: [],
      },
    ],
    requested: [
      { subjectId, module: "musicbrainz" },
      { subjectId, module: "mlc_recording" },
    ],
    permittedModules: ["musicbrainz"],
  });
  const d = deps();
  const results = await runPlannedContextModules(plan, d);
  expect(results.map(result => result.status)).toEqual(["saved", "blocked"]);
  expect(d.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ module: "musicbrainz", subjectId }),
    {},
  );
  expect(d.dispatch).toHaveBeenCalledTimes(1);
});
it("does not treat an ambiguous collector receipt as a completed dependency", async () => {
  const d = deps();
  d.dispatch.mockResolvedValue({ state: "running" });
  const results = await runPlannedContextModules([node("audio"), node("summary", ["audio"])], d);
  expect(results.map(result => result.status)).toEqual(["failed", "blocked"]);
  expect(d.dispatch).toHaveBeenCalledTimes(1);
});
it("persists why work was skipped without losing planner or dependency distinctions", async () => {
  const d = deps();
  d.dispatch.mockRejectedValue(new Error("provider secret"));
  const results = await runPlannedContextModules(
    [
      { ...node("missing", [], "blocked"), reasons: ["Missing isrc"] },
      {
        ...node("future", [], "not_implemented"),
        reasons: ["Context collector is not implemented"],
      },
      node("failed"),
      node("dependent", ["failed"]),
    ],
    d,
  );
  expect(results[0]).toMatchObject({ blockReason: "plan_blocked", reasons: ["Missing isrc"] });
  expect(results[1]).toMatchObject({
    blockReason: "not_implemented",
    reasons: ["Context collector is not implemented"],
  });
  expect(results[3]).toMatchObject({
    blockReason: "dependency_failed",
    blockedBy: ["failed"],
    reasons: [],
  });
  for (const result of results) expect(d.persistOutcome).toHaveBeenCalledWith(result);
  expect(JSON.stringify(results)).not.toContain("provider secret");
});

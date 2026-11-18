import { describe, expect, it, vi } from "vitest";
import { pollPackAdmission } from "../pollPackAdmission";
import type { PackAdmissionObservation } from "../packAdmissionTypes";
const start = { workflowRunId: "run-original", startedAt: 1_000_000 };
const actor = { accountId: "member", organizationId: "OWNER" };
const expiry = new Date(start.startedAt + 120_000).toISOString();
function fixture() {
  let now = start.startedAt;
  const observation: PackAdmissionObservation = {
    workflowRunId: start.workflowRunId,
    observedAt: now,
    job: {
      id: "job",
      owner_id: "owner",
      status: "running",
      workflow_run_id: null,
      hold_expires_at: expiry,
    },
  };
  const read = vi.fn(async () => ({ ...structuredClone(observation), observedAt: now }));
  const sleepUntil = vi.fn(async (date: Date) => {
    now = date.getTime();
  });
  return {
    observation,
    read,
    sleepUntil,
    setNow: (value: number) => {
      now = value;
    },
    run: () => pollPackAdmission(actor, "job", start, { read, sleepUntil }),
  };
}
describe("unwired finite pack admission wait", () => {
  it("admits matching saved ID on the first fresh read without waiting", async () => {
    const f = fixture();
    f.observation.job.workflow_run_id = start.workflowRunId;
    expect(await f.run()).toMatchObject({
      status: "admitted",
      job_id: "job",
      workflow_run_id: start.workflowRunId,
      hold_expires_at: expiry,
      deadline_at: start.startedAt + 30_000,
    });
    expect(f.read).toHaveBeenCalledExactlyOnceWith(actor, "job");
    expect(f.sleepUntil).not.toHaveBeenCalled();
  });
  it("uses distinct fresh reads after durable waits and admits a delayed ID", async () => {
    const f = fixture();
    const read = f.read.getMockImplementation()!;
    f.read.mockImplementation(async () => {
      if (f.read.mock.calls.length === 3) f.observation.job.workflow_run_id = start.workflowRunId;
      return read();
    });
    expect(await f.run()).toMatchObject({ status: "admitted" });
    expect(f.read).toHaveBeenCalledTimes(3);
    expect(f.sleepUntil.mock.calls.map(([d]) => d.getTime())).toEqual([
      start.startedAt + 1000,
      start.startedAt + 2000,
    ]);
  });
  it("keeps the original 30 second deadline and IDs when admission never arrives", async () => {
    const f = fixture();
    expect(await f.run()).toEqual({
      status: "needs-reconciliation",
      reason: "deadline",
      job_id: "job",
      workflow_run_id: start.workflowRunId,
      hold_expires_at: expiry,
      deadline_at: start.startedAt + 30_000,
    });
    expect(f.read).toHaveBeenCalledTimes(31);
    expect(f.sleepUntil).toHaveBeenCalledTimes(30);
  });
  it("does not reset a journaled start deadline after a delayed/restarted read", async () => {
    const f = fixture();
    f.setNow(start.startedAt + 31_000);
    f.observation.job.workflow_run_id = start.workflowRunId;
    expect(await f.run()).toMatchObject({
      status: "needs-reconciliation",
      reason: "deadline",
      deadline_at: start.startedAt + 30_000,
    });
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.sleepUntil).not.toHaveBeenCalled();
  });
  for (const [field, value, reason] of [
    ["workflow_run_id", "other-run", "different-run"],
    ["workflow_run_id", "", "different-run"],
    ["status", "completed", "not-running"],
    ["id", "other-job", "scope"],
    ["owner_id", "other-owner", "scope"],
    ["hold_expires_at", null, "invalid-hold"],
    ["hold_expires_at", "invalid", "invalid-hold"],
    ["hold_expires_at", new Date(start.startedAt).toISOString(), "expired-hold"],
  ] as const)
    it(`rejects ${field}=${value} without another read or wait`, async () => {
      const f = fixture();
      Object.assign(f.observation.job, { [field]: value });
      expect(await f.run()).toMatchObject({ status: "needs-reconciliation", reason });
      expect(f.read).toHaveBeenCalledTimes(1);
      expect(f.sleepUntil).not.toHaveBeenCalled();
    });
  it("does not poll past hold expiry or renew the original hold", async () => {
    const f = fixture();
    const short = new Date(start.startedAt + 350).toISOString();
    f.observation.job.hold_expires_at = short;
    expect(await f.run()).toMatchObject({ reason: "expired-hold", hold_expires_at: short });
    expect(f.sleepUntil.mock.calls.map(([d]) => d.getTime())).toEqual([start.startedAt + 350]);
  });
  it("reports read/access failure without a retry or invented hold expiry", async () => {
    const f = fixture();
    f.read.mockRejectedValue(new Error("access denied"));
    expect(await f.run()).toMatchObject({
      status: "needs-reconciliation",
      reason: "read-failed",
      hold_expires_at: null,
    });
    expect(f.read).toHaveBeenCalledTimes(1);
    expect(f.sleepUntil).not.toHaveBeenCalled();
  });
  it("rejects a changed executing run ID", async () => {
    const f = fixture();
    f.observation.workflowRunId = "other-run";
    expect(await f.run()).toMatchObject({
      reason: "different-run",
      workflow_run_id: start.workflowRunId,
    });
    expect(f.sleepUntil).not.toHaveBeenCalled();
  });
  it("rejects a nonfinite or backwards clock", async () => {
    for (const value of [NaN, start.startedAt - 1]) {
      const f = fixture();
      f.setNow(value);
      expect(await f.run()).toMatchObject({ reason: "invalid-clock" });
      expect(f.sleepUntil).not.toHaveBeenCalled();
    }
  });
  it("keeps the original hold boundary when a later read shows an extension", async () => {
    const f = fixture();
    const original = new Date(start.startedAt + 1500).toISOString();
    f.observation.job.hold_expires_at = original;
    const read = f.read.getMockImplementation()!;
    f.read.mockImplementation(async () => {
      if (f.read.mock.calls.length > 1) f.observation.job.hold_expires_at = expiry;
      return read();
    });
    expect(await f.run()).toMatchObject({ reason: "expired-hold", hold_expires_at: original });
    expect(f.sleepUntil.mock.calls.map(([d]) => d.getTime())).toEqual([
      start.startedAt + 1000,
      start.startedAt + 1500,
    ]);
  });
  it("retains known hold identity on a later read failure without retry", async () => {
    const f = fixture();
    const read = f.read.getMockImplementation()!;
    f.read.mockImplementationOnce(read).mockRejectedValue(new Error("connection lost"));
    expect(await f.run()).toMatchObject({ reason: "read-failed", hold_expires_at: expiry });
    expect(f.read).toHaveBeenCalledTimes(2);
    expect(f.sleepUntil).toHaveBeenCalledTimes(1);
  });
  it("returns reconciliation if durable waiting fails without polling again", async () => {
    const f = fixture();
    f.sleepUntil.mockRejectedValue(new Error("wait failed"));
    expect(await f.run()).toMatchObject({ reason: "wait-failed", hold_expires_at: expiry });
    expect(f.read).toHaveBeenCalledTimes(1);
  });
});

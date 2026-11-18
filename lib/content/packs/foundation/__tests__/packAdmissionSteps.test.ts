import { beforeEach, describe, expect, it, vi } from "vitest";
import { startPackAdmissionStep } from "@/app/workflows/packs/foundation/startPackAdmissionStep";
import { readPackAdmissionStep } from "@/app/workflows/packs/foundation/readPackAdmissionStep";
const boundary = vi.hoisted(() => ({ rpc: vi.fn(), runId: "executing-run" }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: boundary.rpc } }));
vi.mock("workflow", () => ({ getWorkflowMetadata: () => ({ workflowRunId: boundary.runId }) }));
describe("actual admission durable steps at mocked RPC boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.runId = "executing-run";
  });
  it("journals a start clock and executing run without a database call", async () => {
    const before = Date.now();
    const value = await startPackAdmissionStep();
    expect(value.workflowRunId).toBe("executing-run");
    expect(value.startedAt).toBeGreaterThanOrEqual(before);
    expect(value.startedAt).toBeLessThanOrEqual(Date.now());
    expect(boundary.rpc).not.toHaveBeenCalled();
    expect(startPackAdmissionStep.maxRetries).toBe(0);
  });
  it("forwards exact account/org/job authority through the existing read RPC", async () => {
    const job = {
      id: "job",
      owner_id: "ORG",
      status: "running",
      workflow_run_id: null,
      hold_expires_at: "2099-01-01T00:00:00Z",
      unrelated: "not returned",
    };
    boundary.rpc.mockResolvedValue({ data: { job, assets: [] }, error: null });
    const result = await readPackAdmissionStep(
      { accountId: "member", organizationId: "ORG" },
      "job",
    );
    expect(result.job).toEqual({
      id: "job",
      owner_id: "ORG",
      status: "running",
      workflow_run_id: null,
      hold_expires_at: job.hold_expires_at,
    });
    expect(result.workflowRunId).toBe("executing-run");
    expect(Number.isFinite(result.observedAt)).toBe(true);
    expect(boundary.rpc).toHaveBeenCalledExactlyOnceWith("release_pack_command", {
      p_actor: "member",
      p_org: "ORG",
      p_action: "read",
      p_job: "job",
      p_input: {},
    });
    expect(readPackAdmissionStep.maxRetries).toBe(0);
  });
  it("propagates denied reads without admission writes or local retries", async () => {
    boundary.rpc.mockResolvedValue({ data: null, error: { message: "access denied" } });
    await expect(readPackAdmissionStep({ accountId: "member" }, "job")).rejects.toThrow(
      "access denied",
    );
    expect(boundary.rpc).toHaveBeenCalledTimes(1);
  });
});

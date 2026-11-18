import { describe, expect, it, vi } from "vitest";
import { getPackExecutionFence } from "../getPackExecutionFence";
import { getPackAssetFence } from "../getPackAssetFence";
import { runPackFalRequest } from "../../runPackFalRequest";
const provider = vi.hoisted(() => ({ submit: vi.fn(), status: vi.fn(), result: vi.fn() }));
vi.mock("@/lib/fal/server", () => ({ default: { queue: provider } }));
const id = "00000000-0000-4000-8000-000000000001";
const job = {
  protocol: 2,
  revision: 1,
  execution_id: id,
  execution_version: 2,
  workflow_run_id: "run-original",
};
describe("dormant Pack worker fence", () => {
  it("retains original execution and claim; never fills missing identity", () => {
    expect(getPackExecutionFence(job)).toEqual({
      expected_revision: 1,
      execution_id: id,
      execution_version: 2,
      workflow_run_id: "run-original",
    });
    expect(getPackAssetFence(job, { attempt: 3, claim_id: id })).toMatchObject({
      asset_attempt: 3,
      claim_id: id,
    });
    expect(() => getPackExecutionFence({ ...job, execution_id: undefined })).toThrow();
    expect(() => getPackAssetFence(job, { attempt: 3 })).toThrow();
    expect(getPackExecutionFence({ revision: 1 })).toEqual({});
  });
  it("commits accepted observation before attempting phase; never polls on stale refusal", async () => {
    const order: string[] = [];
    provider.submit.mockResolvedValue({ request_id: "accepted-original" });
    const save = vi.fn(async (_key, receipt) => {
      order.push(`phase:${receipt.state}`);
      if (receipt.state === "accepted") throw new Error("stale");
      return { operation_id: id, operation_created: true };
    });
    await expect(
      runPackFalRequest({
        model: "fixture",
        input: {},
        chargeCredits: 1,
        key: "image_submission_0",
        state: {},
        save,
        observe: async receipt => {
          order.push(`observation:${receipt.state}`);
        },
      }),
    ).rejects.toThrow("stale");
    expect(order).toEqual(["phase:submitting", "observation:accepted", "phase:accepted"]);
    expect(provider.status).not.toHaveBeenCalled();
  });
  it("never submits again on a duplicate or lost-ack intent", async () => {
    provider.submit.mockClear();
    await expect(
      runPackFalRequest({
        model: "fixture",
        input: {},
        chargeCredits: 1,
        key: "image_submission_0",
        state: {},
        save: async () => ({ operation_id: id, operation_created: false }),
        observe: async () => {},
      }),
    ).rejects.toThrow("without resubmission");
    expect(provider.submit).not.toHaveBeenCalled();
  });
  it("does not submit if durable intent registration fails", async () => {
    provider.submit.mockClear();
    await expect(
      runPackFalRequest({
        model: "fixture",
        input: {},
        chargeCredits: 1,
        key: "image_submission_0",
        state: {},
        save: async () => {
          throw new Error("registration failed");
        },
        observe: async () => {},
      }),
    ).rejects.toThrow("registration failed");
    expect(provider.submit).not.toHaveBeenCalled();
  });
});

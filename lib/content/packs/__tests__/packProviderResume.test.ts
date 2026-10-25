import { beforeEach, describe, expect, it, vi } from "vitest";
import fal from "@/lib/fal/server";
import { runPackFalRequest } from "../runPackFalRequest";
vi.mock("@/lib/fal/server", () => ({
  default: { queue: { submit: vi.fn(), status: vi.fn(), result: vi.fn() } },
}));
describe("pack provider acceptance", () => {
  beforeEach(() => vi.resetAllMocks());
  it("persists an accepted ID before fetching results and never resubmits it", async () => {
    const state: Record<string, unknown> = {
      image_submission_0: {
        state: "accepted",
        request_id: "accepted-id",
        charge_credits: 100,
        model: "original-model",
        input_sha256: "original-input-hash",
      },
    };
    vi.mocked(fal.queue.status).mockResolvedValue({ status: "COMPLETED" } as never);
    vi.mocked(fal.queue.result).mockResolvedValue({
      data: { images: [{ url: "https://example.com/out.png" }] },
    } as never);
    const save = vi.fn();
    const result = await runPackFalRequest({
      model: "new-default-model",
      input: {},
      chargeCredits: 200,
      key: "image_submission_0",
      state,
      save,
    });
    expect(fal.queue.submit).not.toHaveBeenCalled();
    expect(fal.queue.status).toHaveBeenCalledWith("original-model", {
      requestId: "accepted-id",
      logs: false,
    });
    expect(fal.queue.result).toHaveBeenCalledWith("original-model", { requestId: "accepted-id" });
    expect(result.images).toHaveLength(1);
    expect(save).toHaveBeenCalledWith(
      "image_submission_0",
      expect.objectContaining({
        state: "complete",
        request_id: "accepted-id",
        model: "original-model",
        charge_credits: 100,
        input_sha256: "original-input-hash",
      }),
    );
  });
  it("persists model, input fingerprint and charge before submission and retains them at completion", async () => {
    const state: Record<string, unknown> = {};
    const save = vi.fn();
    vi.mocked(fal.queue.submit).mockImplementation(async () => {
      expect(save).toHaveBeenCalledWith(
        "image_submission_0",
        expect.objectContaining({
          state: "submitting",
          model: "selected-model",
          charge_credits: 100,
          input_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
      return { request_id: "new-id" } as never;
    });
    vi.mocked(fal.queue.status).mockResolvedValue({ status: "COMPLETED" } as never);
    vi.mocked(fal.queue.result).mockResolvedValue({ data: { images: [] } } as never);
    await runPackFalRequest({
      model: "selected-model",
      input: { prompt: "synthetic" },
      chargeCredits: 100,
      key: "image_submission_0",
      state,
      save,
    });
    const intent = save.mock.calls[0][1];
    expect(save.mock.calls.map(([, receipt]) => receipt)).toEqual([
      intent,
      { ...intent, state: "accepted", request_id: "new-id" },
      { ...intent, state: "complete", request_id: "new-id", data: { images: [] } },
    ]);
    expect(fal.queue.submit).toHaveBeenCalledTimes(1);
  });
  it("retains a legacy accepted receipt for reconciliation rather than guessing its model", async () => {
    const receipt = { state: "accepted", request_id: "old-id", charge_credits: 100 };
    const state = { image_submission_0: receipt };
    const save = vi.fn();
    await expect(
      runPackFalRequest({
        model: "current-default",
        input: {},
        chargeCredits: 100,
        key: "image_submission_0",
        state,
        save,
      }),
    ).rejects.toThrow("model");
    expect(state.image_submission_0).toBe(receipt);
    expect(save).not.toHaveBeenCalled();
    expect(fal.queue.submit).not.toHaveBeenCalled();
    expect(fal.queue.status).not.toHaveBeenCalled();
    expect(fal.queue.result).not.toHaveBeenCalled();
  });
  it("returns completed legacy output without requiring model metadata or contacting the provider", async () => {
    const data = { images: [{ url: "https://example.com/saved.png" }] };
    const save = vi.fn();
    const result = await runPackFalRequest({
      model: "current-default",
      input: {},
      chargeCredits: 100,
      key: "image_submission_0",
      state: { image_submission_0: { state: "complete", data } },
      save,
    });
    expect(result).toBe(data);
    expect(save).not.toHaveBeenCalled();
    expect(fal.queue.submit).not.toHaveBeenCalled();
    expect(fal.queue.status).not.toHaveBeenCalled();
    expect(fal.queue.result).not.toHaveBeenCalled();
  });
  it("blocks ambiguous submission intent instead of issuing a second paid request", async () => {
    await expect(
      runPackFalRequest({
        model: "fixture",
        input: {},
        chargeCredits: 100,
        key: "image_submission_0",
        state: { image_submission_0: { state: "submitting" } },
        save: vi.fn(),
      }),
    ).rejects.toThrow("uncertain");
    expect(fal.queue.submit).not.toHaveBeenCalled();
  });
  it("does not resubmit after the provider accepts but saving its ID fails", async () => {
    const state: Record<string, unknown> = {};
    vi.mocked(fal.queue.submit).mockResolvedValue({ request_id: "accepted-id" } as never);
    const save = vi.fn(async (_key, value) => {
      if (value.state === "accepted") throw new Error("receipt storage unavailable");
    });
    const request = {
      model: "original-model",
      input: { prompt: "synthetic" },
      chargeCredits: 100,
      key: "image_submission_0",
      state,
      save,
    };
    await expect(runPackFalRequest(request)).rejects.toThrow("receipt storage unavailable");
    expect(state.image_submission_0).toEqual(
      expect.objectContaining({
        state: "submitting",
        model: "original-model",
        charge_credits: 100,
      }),
    );
    await expect(runPackFalRequest({ ...request, model: "new-default" })).rejects.toThrow(
      "uncertain",
    );
    expect(fal.queue.submit).toHaveBeenCalledTimes(1);
    expect(fal.queue.status).not.toHaveBeenCalled();
    expect(fal.queue.result).not.toHaveBeenCalled();
  });
  it("does not contact the provider if durable submission-intent storage fails", async () => {
    await expect(
      runPackFalRequest({
        model: "fixture",
        input: {},
        chargeCredits: 100,
        key: "image_submission_0",
        state: {},
        save: vi.fn(async () => {
          throw new Error("storage unavailable");
        }),
      }),
    ).rejects.toThrow("storage unavailable");
    expect(fal.queue.submit).not.toHaveBeenCalled();
  });
});

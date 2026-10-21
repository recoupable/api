import { beforeEach, describe, expect, it, vi } from "vitest";
import fal from "@/lib/fal/server";
import { runPackFalRequest } from "../runPackFalRequest";
vi.mock("@/lib/fal/server", () => ({
  default: { queue: { submit: vi.fn(), status: vi.fn(), result: vi.fn() } },
}));
describe("pack provider acceptance", () => {
  beforeEach(() => vi.clearAllMocks());
  it("persists an accepted ID before fetching results and never resubmits it", async () => {
    const state: Record<string, unknown> = {
      image_submission_0: { state: "accepted", request_id: "accepted-id", charge_credits: 100 },
    };
    vi.mocked(fal.queue.status).mockResolvedValue({ status: "COMPLETED" } as never);
    vi.mocked(fal.queue.result).mockResolvedValue({
      data: { images: [{ url: "https://example.com/out.png" }] },
    } as never);
    const save = vi.fn();
    const result = await runPackFalRequest({
      model: "fixture",
      input: {},
      chargeCredits: 100,
      key: "image_submission_0",
      state,
      save,
    });
    expect(fal.queue.submit).not.toHaveBeenCalled();
    expect(result.images).toHaveLength(1);
    expect(save).toHaveBeenCalledWith(
      "image_submission_0",
      expect.objectContaining({ state: "complete", request_id: "accepted-id" }),
    );
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

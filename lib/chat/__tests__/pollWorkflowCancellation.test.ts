import { describe, it, expect, vi, beforeEach } from "vitest";
import { pollWorkflowCancellation } from "../pollWorkflowCancellation";

const { statusMock } = vi.hoisted(() => ({
  statusMock: vi.fn<() => Promise<string>>(),
}));

vi.mock("workflow/api", () => ({
  getRun: vi.fn(() => ({
    get status() {
      return statusMock();
    },
  })),
}));

describe("pollWorkflowCancellation", () => {
  beforeEach(() => {
    statusMock.mockReset();
  });

  it("aborts the controller when the run flips to cancelled", async () => {
    statusMock
      .mockResolvedValueOnce("running")
      .mockResolvedValueOnce("running")
      .mockResolvedValueOnce("cancelled");

    const controller = new AbortController();
    const { done } = pollWorkflowCancellation("run-1", controller, 1);

    await done;

    expect(controller.signal.aborted).toBe(true);
    expect(statusMock).toHaveBeenCalledTimes(3);
  });

  it("exits cleanly when stop() is invoked before cancellation", async () => {
    statusMock.mockResolvedValue("running");

    const controller = new AbortController();
    const poller = pollWorkflowCancellation("run-1", controller, 1);

    // Let the loop poll at least once, then stop.
    await new Promise(r => setTimeout(r, 5));
    poller.stop();
    await poller.done;

    expect(controller.signal.aborted).toBe(false);
  });

  it("keeps polling through transient errors", async () => {
    statusMock
      .mockRejectedValueOnce(new Error("workflow API hiccup"))
      .mockResolvedValueOnce("running")
      .mockResolvedValueOnce("cancelled");

    const controller = new AbortController();
    const { done } = pollWorkflowCancellation("run-1", controller, 1);

    await done;

    expect(controller.signal.aborted).toBe(true);
    expect(statusMock).toHaveBeenCalledTimes(3);
  });

  it("exits immediately when controller is already aborted at entry", async () => {
    statusMock.mockResolvedValue("running");

    const controller = new AbortController();
    controller.abort();
    const { done } = pollWorkflowCancellation("run-1", controller, 1);

    await done;

    expect(statusMock).not.toHaveBeenCalled();
  });
});

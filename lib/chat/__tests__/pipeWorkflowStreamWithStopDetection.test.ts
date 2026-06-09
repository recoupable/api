import { describe, it, expect, vi, beforeEach } from "vitest";
import { pipeWorkflowStreamWithStopDetection } from "@/lib/chat/pipeWorkflowStreamWithStopDetection";
import { getRun } from "workflow/api";

vi.mock("workflow/api", () => ({ getRun: vi.fn() }));

const mockStatus = (value: string | Error) =>
  vi.mocked(getRun).mockReturnValue({
    get status() {
      return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
    },
  } as unknown as ReturnType<typeof getRun>);

const makeParams = (pipeTo: () => Promise<void>) => {
  const poller = { stop: vi.fn(), done: Promise.resolve() };
  const cancelController = new AbortController();
  return {
    poller,
    cancelController,
    params: {
      uiStream: { pipeTo } as unknown as ReadableStream<never>,
      writable: {} as unknown as WritableStream<never>,
      cancelController,
      workflowRunId: "run-1",
      poller,
    } as Parameters<typeof pipeWorkflowStreamWithStopDetection>[0],
  };
};

describe("pipeWorkflowStreamWithStopDetection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns false on natural completion (pipe resolves, status not cancelled)", async () => {
    mockStatus("completed");
    const { params, poller, cancelController } = makeParams(() => Promise.resolve());
    await expect(pipeWorkflowStreamWithStopDetection(params)).resolves.toBe(false);
    expect(poller.stop).toHaveBeenCalled();
    expect(cancelController.signal.aborted).toBe(true); // finally aborts unconditionally
  });

  it("returns true when pipe resolves cleanly but the run was cancelled", async () => {
    mockStatus("cancelled");
    const { params } = makeParams(() => Promise.resolve());
    await expect(pipeWorkflowStreamWithStopDetection(params)).resolves.toBe(true);
  });

  it("treats a transient status-read error after a clean pipe as success (false)", async () => {
    mockStatus(new Error("status blip"));
    const { params } = makeParams(() => Promise.resolve());
    await expect(pipeWorkflowStreamWithStopDetection(params)).resolves.toBe(false);
  });

  it("returns true when pipe rejects and the controller was aborted (user-stop)", async () => {
    const { params, cancelController } = makeParams(() => {
      cancelController.abort();
      return Promise.reject(new Error("aborted"));
    });
    await expect(pipeWorkflowStreamWithStopDetection(params)).resolves.toBe(true);
  });

  it("rethrows a genuine pipe error when the controller was NOT aborted", async () => {
    const { params, poller } = makeParams(() => Promise.reject(new Error("disk full")));
    await expect(pipeWorkflowStreamWithStopDetection(params)).rejects.toThrow("disk full");
    expect(poller.stop).toHaveBeenCalled(); // finally still runs
  });
});

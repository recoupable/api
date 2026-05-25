import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearChatActiveStreamWhenWorkflowFinishes } from "@/lib/chat/clearChatActiveStreamWhenWorkflowFinishes";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";

vi.mock("@/lib/chat/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

function buildRunStub({ runId, returnValue }: { runId: string; returnValue: Promise<unknown> }) {
  return { runId, returnValue } as unknown as {
    runId: string;
    returnValue: Promise<unknown>;
  };
}

describe("clearChatActiveStreamWhenWorkflowFinishes", () => {
  it("CAS-clears active_stream_id back to null when the workflow resolves", async () => {
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({
      ok: true,
      claimed: true,
    });
    const run = buildRunStub({
      runId: "wrun_ok",
      returnValue: Promise.resolve(undefined),
    });

    await clearChatActiveStreamWhenWorkflowFinishes({ chatId: "chat-1", run });

    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledWith("chat-1", "wrun_ok", null);
  });

  it("still clears when the workflow rejects (cancelled / failed run)", async () => {
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({
      ok: true,
      claimed: true,
    });
    const run = buildRunStub({
      runId: "wrun_fail",
      returnValue: Promise.reject(new Error("boom")),
    });

    await clearChatActiveStreamWhenWorkflowFinishes({ chatId: "chat-1", run });

    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledWith("chat-1", "wrun_fail", null);
  });

  it("waits for the workflow to finish before issuing the CAS", async () => {
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({
      ok: true,
      claimed: true,
    });
    let resolveRun: (v: unknown) => void = () => undefined;
    const returnValue = new Promise(res => {
      resolveRun = res;
    });
    const run = buildRunStub({ runId: "wrun_slow", returnValue });

    const promise = clearChatActiveStreamWhenWorkflowFinishes({
      chatId: "chat-1",
      run,
    });

    // Give the microtask queue a chance — CAS should NOT have fired yet.
    await Promise.resolve();
    await Promise.resolve();
    expect(compareAndSetChatActiveStreamId).not.toHaveBeenCalled();

    resolveRun(undefined);
    await promise;
    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the CAS fails (race lost or DB error)", async () => {
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({
      ok: true,
      claimed: false,
    });
    const run = buildRunStub({
      runId: "wrun_lostrace",
      returnValue: Promise.resolve(undefined),
    });

    await expect(
      clearChatActiveStreamWhenWorkflowFinishes({ chatId: "chat-1", run }),
    ).resolves.toBeUndefined();
  });
});

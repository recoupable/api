import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UIMessageChunk } from "ai";
import { getRun } from "workflow/api";
import { wrapWorkflowStreamWatcher } from "@/lib/chat/wrapWorkflowStreamWatcher";
import {
  RUN_ID,
  chunkSource,
  collect,
  delayedChunkSource,
  mockRun,
} from "@/lib/chat/__tests__/wrapWorkflowStreamWatcher.testHelpers";

vi.mock("workflow/api", () => ({ getRun: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wrapWorkflowStreamWatcher forwarding", () => {
  it("forwards all chunks from the source when the source closes naturally", async () => {
    mockRun({ status: () => "running" });
    const source = chunkSource([
      { type: "text-start", id: "a" } as UIMessageChunk,
      { type: "text-delta", id: "a", delta: "hi" } as UIMessageChunk,
      { type: "text-end", id: "a" } as UIMessageChunk,
    ]);
    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));
    expect(out).toHaveLength(3);
    expect(out[0]?.type).toBe("text-start");
  });

  it("drains the source fully before closing when run is already terminal", async () => {
    mockRun({ status: () => "cancelled" });
    const source = delayedChunkSource(
      [
        { type: "text-start", id: "a" } as UIMessageChunk,
        { type: "text-delta", id: "a", delta: "late" } as UIMessageChunk,
        { type: "text-end", id: "a" } as UIMessageChunk,
      ],
      20,
    );

    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));

    expect(out).toHaveLength(3);
    expect(out.map(c => c.type)).toEqual(["text-start", "text-delta", "text-end"]);
  });

  it("propagates consumer cancel to getRun(runId).cancel()", async () => {
    const cancelSpy = vi.fn(() => Promise.resolve());
    mockRun({ status: () => "running", cancel: cancelSpy });

    const source = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: "text-start", id: "a" } as UIMessageChunk);
      },
    });

    const wrapped = wrapWorkflowStreamWatcher(RUN_ID, source);
    const reader = wrapped.getReader();
    await reader.read();
    await reader.cancel();

    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});

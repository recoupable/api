import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UIMessageChunk } from "ai";
import { getRun } from "workflow/api";
import { wrapWorkflowStreamWatcher } from "@/lib/chat/wrapWorkflowStreamWatcher";

vi.mock("workflow/api", () => ({
  getRun: vi.fn(),
}));

const RUN_ID = "wrun_test_abc";

/**
 * `getRun(...).status` is a getter — `await getRun(id).status` reads the
 * property each time. We model it with a mutable container so tests can
 * change the resolved value while the watcher is polling.
 */
function mockRun(opts: { status: () => string; cancel?: () => Promise<void> }) {
  const cancel = opts.cancel ?? vi.fn(() => Promise.resolve());
  vi.mocked(getRun).mockReturnValue({
    get status() {
      return Promise.resolve(opts.status());
    },
    cancel,
  } as never);
  return { cancel };
}

async function collect(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const reader = stream.getReader();
  const out: UIMessageChunk[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(value);
  }
}

function chunkSource(chunks: UIMessageChunk[]): ReadableStream<UIMessageChunk> {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wrapWorkflowStreamWatcher", () => {
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

  it("on terminal status, synthesizes tool-output-error for tool-calls that were started but never closed", async () => {
    // Status flips to "cancelled" after the first poll tick.
    let status = "running";
    mockRun({ status: () => status });

    // Source emits a tool-input-start (open) and a text chunk, then hangs
    // open — the watcher should close the consumer once status flips,
    // synthesizing a tool-output-error for the open toolCallId.
    const source = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({
          type: "tool-input-start",
          toolCallId: "tool-1",
          toolName: "bash",
        } as UIMessageChunk);
        controller.enqueue({ type: "text-start", id: "a" } as UIMessageChunk);
        // Intentionally leave open — wait for watcher to terminate.
      },
    });

    // Flip status after a tick so the watcher sees "cancelled".
    setTimeout(() => {
      status = "cancelled";
    }, 50);

    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));
    const synthetic = out.find(c => c.type === "tool-output-error");
    expect(synthetic).toBeDefined();
    expect((synthetic as { toolCallId: string }).toolCallId).toBe("tool-1");
    expect((synthetic as { errorText: string }).errorText).toBe("Cancelled");
  }, 10_000);

  it("does NOT synthesize a tool-output-error for a tool-call that already received a terminal output chunk", async () => {
    let status = "running";
    mockRun({ status: () => status });

    const source = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({
          type: "tool-input-start",
          toolCallId: "tool-1",
          toolName: "bash",
        } as UIMessageChunk);
        controller.enqueue({
          type: "tool-output-available",
          toolCallId: "tool-1",
          output: { ok: true },
        } as UIMessageChunk);
        controller.enqueue({
          type: "tool-input-start",
          toolCallId: "tool-2",
          toolName: "bash",
        } as UIMessageChunk);
        // tool-2 stays open.
      },
    });

    setTimeout(() => {
      status = "cancelled";
    }, 50);

    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));
    const synthetic = out.filter(c => c.type === "tool-output-error");
    expect(synthetic).toHaveLength(1);
    expect((synthetic[0] as { toolCallId: string }).toolCallId).toBe("tool-2");
  }, 10_000);

  it("synthesizes tool-output-error on natural source close when tool-calls are still open", async () => {
    // Runtime closes the workflow readable on cancel — the main loop sees
    // done:true before the status watcher's poll tick fires. The synthesis
    // path must run on this close too.
    mockRun({ status: () => "running" });

    const source = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({
          type: "tool-input-start",
          toolCallId: "tool-1",
          toolName: "bash",
        } as UIMessageChunk);
        // Close immediately — emulates runtime-close-on-cancel where the
        // tool was mid-execution and never got a tool-output-* chunk.
        controller.close();
      },
    });

    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));
    const synthetic = out.find(c => c.type === "tool-output-error");
    expect(synthetic).toBeDefined();
    expect((synthetic as { toolCallId: string }).toolCallId).toBe("tool-1");
  });

  it("does not synthesize errors when the source closes cleanly with all tools resolved", async () => {
    mockRun({ status: () => "running" });
    const source = chunkSource([
      { type: "tool-input-start", toolCallId: "t1", toolName: "bash" } as UIMessageChunk,
      { type: "tool-output-available", toolCallId: "t1", output: {} } as UIMessageChunk,
      { type: "text-start", id: "a" } as UIMessageChunk,
    ]);
    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));
    expect(out.find(c => c.type === "tool-output-error")).toBeUndefined();
  });

  it("tracks tool-input-available as an open tool-call too (non-streaming tools)", async () => {
    mockRun({ status: () => "running" });
    const source = new ReadableStream<UIMessageChunk>({
      start(controller) {
        // Some tools skip tool-input-start and emit tool-input-available directly.
        controller.enqueue({
          type: "tool-input-available",
          toolCallId: "tool-x",
          toolName: "bash",
          input: { cmd: "ls" },
        } as UIMessageChunk);
        controller.close();
      },
    });
    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));
    const synthetic = out.find(c => c.type === "tool-output-error");
    expect(synthetic).toBeDefined();
    expect((synthetic as { toolCallId: string }).toolCallId).toBe("tool-x");
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
    await reader.read(); // pull the first chunk so start() runs
    await reader.cancel();

    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});

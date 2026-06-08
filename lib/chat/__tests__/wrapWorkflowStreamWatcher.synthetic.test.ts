import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UIMessageChunk } from "ai";
import { getRun } from "workflow/api";
import { wrapWorkflowStreamWatcher } from "@/lib/chat/wrapWorkflowStreamWatcher";
import {
  RUN_ID,
  chunkSource,
  collect,
  mockRun,
} from "@/lib/chat/__tests__/wrapWorkflowStreamWatcher.testHelpers";

vi.mock("workflow/api", () => ({ getRun: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wrapWorkflowStreamWatcher synthetic tool errors", () => {
  it("synthesizes tool-output-error after the source closes when a tool-call stayed open", async () => {
    mockRun({ status: () => "running" });
    const source = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({
          type: "tool-input-start",
          toolCallId: "tool-mid",
          toolName: "bash",
        } as UIMessageChunk);
        controller.close();
      },
    });
    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));
    const synthetic = out.find(c => c.type === "tool-output-error");
    expect(synthetic).toBeDefined();
    expect((synthetic as { toolCallId: string }).toolCallId).toBe("tool-mid");
  });

  it("emits tool-input-available before tool-output-error when only tool-input-start was seen", async () => {
    mockRun({ status: () => "running" });
    const source = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({
          type: "tool-input-start",
          toolCallId: "tool-mid",
          toolName: "bash",
        } as UIMessageChunk);
        controller.close();
      },
    });
    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));
    const idxAvail = out.findIndex(
      c =>
        c.type === "tool-input-available" &&
        (c as { toolCallId: string }).toolCallId === "tool-mid",
    );
    const idxErr = out.findIndex(
      c =>
        c.type === "tool-output-error" && (c as { toolCallId: string }).toolCallId === "tool-mid",
    );
    expect(idxAvail).toBeGreaterThanOrEqual(0);
    expect(idxErr).toBeGreaterThan(idxAvail);
  });

  it("does NOT synthesize a tool-output-error for a tool-call that already closed", async () => {
    mockRun({ status: () => "running" });
    const source = chunkSource([
      { type: "tool-input-start", toolCallId: "t1", toolName: "bash" } as UIMessageChunk,
      { type: "tool-output-available", toolCallId: "t1", output: {} } as UIMessageChunk,
      { type: "text-start", id: "a" } as UIMessageChunk,
    ]);
    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));
    expect(out.find(c => c.type === "tool-output-error")).toBeUndefined();
  });

  it("synthesizes only for tool-calls still open when one already finished", async () => {
    mockRun({ status: () => "running" });
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
        controller.close();
      },
    });
    const out = await collect(wrapWorkflowStreamWatcher(RUN_ID, source));
    const synthetic = out.filter(c => c.type === "tool-output-error");
    expect(synthetic).toHaveLength(1);
    expect((synthetic[0] as { toolCallId: string }).toolCallId).toBe("tool-2");
  });

  it("tracks tool-input-available as an open tool-call (non-streaming tools)", async () => {
    mockRun({ status: () => "running" });
    const source = new ReadableStream<UIMessageChunk>({
      start(controller) {
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
});

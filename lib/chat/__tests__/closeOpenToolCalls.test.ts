import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";
import { closeOpenToolCalls } from "@/lib/chat/closeOpenToolCalls";

function msg(parts: UIMessage["parts"]): UIMessage {
  return { id: "m1", role: "assistant", parts } as UIMessage;
}

describe("closeOpenToolCalls", () => {
  it("returns the same reference when no tool parts are open", () => {
    const m = msg([
      { type: "text", text: "hello" } as never,
      {
        type: "tool-bash",
        toolCallId: "t1",
        state: "output-available",
        input: { cmd: "ls" },
        output: { stdout: "ok" },
      } as never,
    ]);
    expect(closeOpenToolCalls(m)).toBe(m);
  });

  it("transitions an input-streaming tool part to output-error", () => {
    const m = msg([
      {
        type: "tool-bash",
        toolCallId: "t1",
        state: "input-streaming",
        input: { cmd: "ls" },
      } as never,
    ]);
    const closed = closeOpenToolCalls(m);
    expect(closed).not.toBe(m);
    const part = closed.parts[0] as { state: string; errorText: string };
    expect(part.state).toBe("output-error");
    expect(part.errorText).toBe("Cancelled");
  });

  it("transitions an input-available tool part to output-error", () => {
    const m = msg([
      {
        type: "tool-bash",
        toolCallId: "t1",
        state: "input-available",
        input: { cmd: "sleep 30" },
      } as never,
    ]);
    const closed = closeOpenToolCalls(m);
    const part = closed.parts[0] as { state: string; errorText: string };
    expect(part.state).toBe("output-error");
    expect(part.errorText).toBe("Cancelled");
  });

  it("handles dynamic-tool parts the same way", () => {
    const m = msg([
      {
        type: "dynamic-tool",
        toolName: "mcp_send_email",
        toolCallId: "t2",
        state: "input-available",
        input: { to: "x@y" },
      } as never,
    ]);
    const closed = closeOpenToolCalls(m);
    const part = closed.parts[0] as { state: string; errorText: string };
    expect(part.state).toBe("output-error");
    expect(part.errorText).toBe("Cancelled");
  });

  it("leaves already-terminal tool parts untouched", () => {
    const m = msg([
      {
        type: "tool-bash",
        toolCallId: "t1",
        state: "output-error",
        input: { cmd: "ls" },
        errorText: "boom",
      } as never,
      {
        type: "tool-bash",
        toolCallId: "t2",
        state: "output-denied",
        input: { cmd: "rm" },
        approval: { id: "a1", approved: false },
      } as never,
    ]);
    expect(closeOpenToolCalls(m)).toBe(m);
  });

  it("does not touch non-tool parts", () => {
    const m = msg([
      { type: "text", text: "hello" } as never,
      { type: "reasoning", text: "thinking..." } as never,
      { type: "step-start" } as never,
      {
        type: "tool-bash",
        toolCallId: "t1",
        state: "input-streaming",
        input: {},
      } as never,
    ]);
    const closed = closeOpenToolCalls(m);
    expect(closed.parts[0]).toBe(m.parts[0]);
    expect(closed.parts[1]).toBe(m.parts[1]);
    expect(closed.parts[2]).toBe(m.parts[2]);
    expect((closed.parts[3] as { state: string }).state).toBe("output-error");
  });

  it("closes multiple open tool parts in one pass", () => {
    const m = msg([
      {
        type: "tool-bash",
        toolCallId: "t1",
        state: "input-streaming",
        input: {},
      } as never,
      { type: "text", text: "between" } as never,
      {
        type: "dynamic-tool",
        toolName: "mcp_x",
        toolCallId: "t2",
        state: "input-available",
        input: {},
      } as never,
    ]);
    const closed = closeOpenToolCalls(m);
    expect((closed.parts[0] as { state: string }).state).toBe("output-error");
    expect((closed.parts[2] as { state: string }).state).toBe("output-error");
  });
});

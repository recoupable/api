import { describe, it, expect } from "vitest";
import type { UIMessage } from "ai";
import { closeOpenToolCalls } from "@/lib/chat/closeOpenToolCalls";

function msg(parts: UIMessage["parts"]): UIMessage {
  return { id: "m1", role: "assistant", parts } as UIMessage;
}

describe("closeOpenToolCalls open tools", () => {
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

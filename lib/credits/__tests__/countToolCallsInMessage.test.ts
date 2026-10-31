import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { countToolCallsInMessage } from "../countToolCallsInMessage";

describe("countToolCallsInMessage", () => {
  it("returns zero for a message without tools", () => {
    expect(
      countToolCallsInMessage({
        id: "assistant",
        role: "assistant",
        parts: [{ type: "text", text: "hello" }],
      }),
    ).toBe(0);
    expect(countToolCallsInMessage({ id: "assistant", role: "assistant", parts: [] })).toBe(0);
  });
  it("counts static and dynamic tool parts across their states, without counting nested results", () => {
    const message = {
      id: "assistant",
      role: "assistant",
      parts: [
        {
          type: "tool-lookup",
          toolCallId: "a",
          state: "output-available",
          input: {},
          output: { parts: [{ type: "tool-nested" }] },
        },
        {
          type: "dynamic-tool",
          toolName: "task",
          toolCallId: "b",
          state: "output-error",
          input: {},
          errorText: "failure",
        },
        { type: "tool-pending", toolCallId: "c", state: "input-available", input: {} },
        { type: "text", text: "done" },
        { type: "reasoning", text: "reason" },
        { type: "data-status", data: { state: "done" } },
      ],
    } as UIMessage;
    expect(countToolCallsInMessage(message)).toBe(3);
  });
});

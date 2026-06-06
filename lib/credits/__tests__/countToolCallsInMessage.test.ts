import { describe, it, expect } from "vitest";
import { countToolCallsInMessage } from "../countToolCallsInMessage";

describe("countToolCallsInMessage", () => {
  it("returns 0 when the message has no tool parts", () => {
    expect(
      countToolCallsInMessage({
        id: "m1",
        role: "assistant",
        parts: [{ type: "text", text: "Hello" }],
      }),
    ).toBe(0);
  });

  it("counts each tool UI part on the assistant message", () => {
    expect(
      countToolCallsInMessage({
        id: "m2",
        role: "assistant",
        parts: [
          { type: "text", text: "Running tools" },
          { type: "tool-bash", toolCallId: "tc-1", state: "output-available", input: {}, output: {} },
          { type: "tool-read", toolCallId: "tc-2", state: "output-available", input: {}, output: {} },
        ] as never,
      }),
    ).toBe(2);
  });
});

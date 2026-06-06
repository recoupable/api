import { describe, it, expect } from "vitest";
import type { UIMessageChunk } from "ai";
import { trackToolCallChunk, type OpenTool } from "@/lib/chat/trackToolCallChunk";

const ID = "call-1";

describe("trackToolCallChunk", () => {
  it("records an open tool on tool-input-start (sawInputAvailable false)", () => {
    const open = new Map<string, OpenTool>();
    trackToolCallChunk(
      { type: "tool-input-start", toolCallId: ID, toolName: "bash" } as UIMessageChunk,
      open,
    );
    expect(open.get(ID)).toEqual({ toolName: "bash", sawInputAvailable: false });
  });

  it("marks sawInputAvailable on tool-input-available (records even if start was skipped)", () => {
    const open = new Map<string, OpenTool>();
    trackToolCallChunk(
      {
        type: "tool-input-available",
        toolCallId: ID,
        toolName: "bash",
        input: {},
      } as UIMessageChunk,
      open,
    );
    expect(open.get(ID)).toEqual({ toolName: "bash", sawInputAvailable: true });
  });

  it.each(["tool-output-available", "tool-output-error", "tool-output-denied", "tool-input-error"])(
    "removes the tool on terminal chunk %s",
    type => {
      const open = new Map<string, OpenTool>([[ID, { toolName: "bash", sawInputAvailable: true }]]);
      trackToolCallChunk({ type, toolCallId: ID } as UIMessageChunk, open);
      expect(open.has(ID)).toBe(false);
    },
  );

  it("ignores unrelated chunk types", () => {
    const open = new Map<string, OpenTool>();
    trackToolCallChunk({ type: "text-delta", id: "0", delta: "hi" } as UIMessageChunk, open);
    expect(open.size).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import getExecutedToolTimeline from "../getExecutedToolTimeline";

describe("getExecutedToolTimeline", () => {
  describe("basic functionality", () => {
    it("returns an empty array when steps is empty", () => {
      const result = getExecutedToolTimeline([]);
      expect(result).toEqual([]);
    });

    it("extracts tool names from a single step with one tool result", () => {
      const steps = [
        {
          toolResults: [
            {
              toolCallId: "call-1",
              toolName: "get_spotify_search",
              output: { type: "json", value: {} },
            },
          ],
        },
      ];

      const result = getExecutedToolTimeline(steps as any);
      expect(result).toEqual(["get_spotify_search"]);
    });

    it("extracts tool names from multiple tool results in a single step", () => {
      const steps = [
        {
          toolResults: [
            {
              toolCallId: "call-1",
              toolName: "tool_a",
              output: { type: "json", value: {} },
            },
            {
              toolCallId: "call-2",
              toolName: "tool_b",
              output: { type: "json", value: {} },
            },
          ],
        },
      ];

      const result = getExecutedToolTimeline(steps as any);
      expect(result).toEqual(["tool_a", "tool_b"]);
    });

    it("extracts tool names from multiple steps", () => {
      const steps = [
        {
          toolResults: [
            {
              toolCallId: "call-1",
              toolName: "create_new_artist",
              output: { type: "json", value: {} },
            },
          ],
        },
        {
          toolResults: [
            {
              toolCallId: "call-2",
              toolName: "get_spotify_search",
              output: { type: "json", value: {} },
            },
          ],
        },
        {
          toolResults: [
            {
              toolCallId: "call-3",
              toolName: "update_account_info",
              output: { type: "json", value: {} },
            },
          ],
        },
      ];

      const result = getExecutedToolTimeline(steps as any);
      expect(result).toEqual(["create_new_artist", "get_spotify_search", "update_account_info"]);
    });
  });

  describe("edge cases", () => {
    it("handles steps with empty toolResults array", () => {
      const steps = [
        { toolResults: [] },
        {
          toolResults: [
            {
              toolCallId: "call-1",
              toolName: "tool_a",
              output: { type: "json", value: {} },
            },
          ],
        },
      ];

      const result = getExecutedToolTimeline(steps as any);
      expect(result).toEqual(["tool_a"]);
    });

    it("handles steps with undefined toolResults", () => {
      const steps = [
        {},
        {
          toolResults: [
            {
              toolCallId: "call-1",
              toolName: "tool_a",
              output: { type: "json", value: {} },
            },
          ],
        },
      ];

      const result = getExecutedToolTimeline(steps as any);
      expect(result).toEqual(["tool_a"]);
    });

    it("preserves order of execution across multiple steps", () => {
      const steps = [
        {
          toolResults: [
            { toolCallId: "call-1", toolName: "step1_tool1", output: { type: "json", value: {} } },
            { toolCallId: "call-2", toolName: "step1_tool2", output: { type: "json", value: {} } },
          ],
        },
        {
          toolResults: [
            { toolCallId: "call-3", toolName: "step2_tool1", output: { type: "json", value: {} } },
          ],
        },
        {
          toolResults: [
            { toolCallId: "call-4", toolName: "step3_tool1", output: { type: "json", value: {} } },
            { toolCallId: "call-5", toolName: "step3_tool2", output: { type: "json", value: {} } },
          ],
        },
      ];

      const result = getExecutedToolTimeline(steps as any);
      expect(result).toEqual([
        "step1_tool1",
        "step1_tool2",
        "step2_tool1",
        "step3_tool1",
        "step3_tool2",
      ]);
    });

    it("handles tool results with missing toolCallId", () => {
      const steps = [
        {
          toolResults: [
            {
              toolName: "tool_without_id",
              output: { type: "json", value: {} },
            },
          ],
        },
      ];

      const result = getExecutedToolTimeline(steps as any);
      expect(result).toEqual(["tool_without_id"]);
    });
  });
});

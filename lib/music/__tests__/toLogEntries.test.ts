import { describe, it, expect } from "vitest";
import { toLogEntries } from "../toLogEntries";

describe("toLogEntries", () => {
  it("normalizes fal's queue logs onto the documented shape", () => {
    const falLogs = [
      {
        timestamp: "2026-08-22T02:07:47.580834+00:00",
        message: "  0%|          | 0/180 [00:00<?, ?it/s]",
        labels: { logger: "x" },
      },
      { timestamp: "2026-08-22T02:07:47.700233+00:00", message: "  2% 4/180" },
    ];

    expect(toLogEntries(falLogs)).toEqual([
      {
        at: "2026-08-22T02:07:47.580834+00:00",
        message: "  0%|          | 0/180 [00:00<?, ?it/s]",
      },
      { at: "2026-08-22T02:07:47.700233+00:00", message: "  2% 4/180" },
    ]);
  });

  it("drops entries that carry no message rather than emitting blanks", () => {
    const falLogs = [
      { timestamp: "t1", message: "kept" },
      { timestamp: "t2" },
      { message: "no timestamp" },
      null,
      "a bare string",
    ];

    expect(toLogEntries(falLogs)).toEqual([{ at: "t1", message: "kept" }]);
  });

  it("returns an empty timeline for anything that is not a list", () => {
    expect(toLogEntries(null)).toEqual([]);
    expect(toLogEntries(undefined)).toEqual([]);
    expect(toLogEntries("not a list" as never)).toEqual([]);
  });

  it("caps a very long timeline to the most recent entries", () => {
    const falLogs = Array.from({ length: 500 }, (_, i) => ({
      timestamp: `t${i}`,
      message: `line ${i}`,
    }));

    const result = toLogEntries(falLogs);

    expect(result).toHaveLength(200);
    // The newest lines are the ones kept.
    expect(result[result.length - 1].message).toBe("line 499");
    expect(result[0].message).toBe("line 300");
  });
});

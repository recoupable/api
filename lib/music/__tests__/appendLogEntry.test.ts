import { describe, it, expect } from "vitest";
import { appendLogEntry } from "../appendLogEntry";

describe("appendLogEntry", () => {
  it("appends to an existing timeline, oldest first", () => {
    const existing = [{ at: "2026-08-21T12:00:00.000Z", message: "Run started" }];

    const result = appendLogEntry(existing, "Queued", new Date("2026-08-21T12:00:05.000Z"));

    expect(result).toEqual([
      { at: "2026-08-21T12:00:00.000Z", message: "Run started" },
      { at: "2026-08-21T12:00:05.000Z", message: "Queued" },
    ]);
  });

  it("starts a timeline when the column is empty or null", () => {
    const at = new Date("2026-08-21T12:00:00.000Z");

    expect(appendLogEntry([], "first", at)).toHaveLength(1);
    expect(appendLogEntry(null, "first", at)).toEqual([
      { at: "2026-08-21T12:00:00.000Z", message: "first" },
    ]);
  });

  it("ignores a malformed logs value rather than throwing mid-workflow", () => {
    const at = new Date("2026-08-21T12:00:00.000Z");

    expect(appendLogEntry("not an array" as never, "first", at)).toEqual([
      { at: "2026-08-21T12:00:00.000Z", message: "first" },
    ]);
  });

  it("caps the timeline so a long poll loop cannot grow the row without bound", () => {
    const existing = Array.from({ length: 200 }, (_, i) => ({
      at: "2026-08-21T12:00:00.000Z",
      message: `line ${i}`,
    }));

    const result = appendLogEntry(existing, "newest", new Date());

    expect(result).toHaveLength(200);
    expect(result[result.length - 1].message).toBe("newest");
    // The oldest lines are the ones dropped.
    expect(result[0].message).toBe("line 1");
  });
});

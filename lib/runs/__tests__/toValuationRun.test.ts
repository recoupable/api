import { describe, it, expect } from "vitest";
import { toValuationRun } from "../toValuationRun";
import type { Tables } from "@/types/database.types";

const base = {
  id: "11111111-2222-3333-4444-555555555555",
  account: "acc_1",
  album_count: 9,
  created_at: "2026-08-20T12:00:00Z",
  catalog: null,
  state: "queued",
} as Tables<"playcount_snapshots">;

const now = new Date("2026-08-20T12:05:00Z");

describe("toValuationRun", () => {
  it("maps a queued capture to the queued phase", () => {
    expect(toValuationRun(base, now)).toEqual({
      id: base.id,
      kind: "valuation",
      state: "queued",
      album_count: 9,
      created_at: base.created_at,
      result: null,
    });
  });

  it("maps a running capture to measuring", () => {
    expect(toValuationRun({ ...base, state: "running" }, now).state).toBe("measuring");
  });

  it("maps a claimed run to claimed with the catalog id", () => {
    const run = toValuationRun({ ...base, state: "done", catalog: "cat_1" }, now);
    expect(run.state).toBe("claimed");
    expect(run.result).toEqual({ catalog_id: "cat_1" });
  });

  // The claim lands seconds after the capture finishes; inside the window the
  // run is still in flight from the customer's point of view.
  it("maps done-but-unclaimed to measuring inside the claim window", () => {
    const run = toValuationRun({ ...base, state: "done", created_at: "2026-08-20T11:58:00Z" }, now);
    expect(run.state).toBe("measuring");
  });

  // The orphaned class chat#1965/#1969 kept meeting: capture done, claim never
  // happened. Honest terminal answer, not an eternal "measuring".
  it("maps done-but-unclaimed past the claim window to failed", () => {
    const run = toValuationRun({ ...base, state: "done", created_at: "2026-08-20T11:00:00Z" }, now);
    expect(run.state).toBe("failed");
  });

  it("maps a failed capture to failed", () => {
    expect(toValuationRun({ ...base, state: "failed" }, now).state).toBe("failed");
  });
});

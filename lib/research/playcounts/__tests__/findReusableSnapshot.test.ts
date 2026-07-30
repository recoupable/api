import { describe, it, expect } from "vitest";
import { findReusableSnapshot } from "@/lib/research/playcounts/findReusableSnapshot";
import type { Tables } from "@/types/database.types";

const NOW = new Date("2026-07-30T14:33:32.000Z");

const snapshot = (over: Partial<Tables<"playcount_snapshots">>) =>
  ({
    id: "snap-1",
    account: "acc-1",
    catalog: null,
    album_ids: ["a1", "a2"],
    isrcs: null,
    platforms: ["spotify"],
    schedule: "once",
    state: "done",
    album_count: 2,
    estimated_cost_usd: 0.006,
    created_at: "2026-07-30T14:30:35.000Z",
    updated_at: "2026-07-30T14:30:35.000Z",
    ...over,
  }) as Tables<"playcount_snapshots">;

const find = (rows: Tables<"playcount_snapshots">[], albumIds = ["a1", "a2"]) =>
  findReusableSnapshot({
    snapshots: rows,
    albumIds,
    platforms: ["spotify"],
    schedule: "once",
    windowMinutes: 15,
    now: NOW,
  });

describe("findReusableSnapshot", () => {
  // chat#1912 row 4: one pass through /setup measured the same 24 albums twice
  // — the seeding valuation at 14:30:35, then the first-task pre-run at
  // 14:33:32 — billing the scraper twice for an identical capture.
  it("reuses a capture of the same albums taken minutes ago", () => {
    expect(find([snapshot({})])?.id).toBe("snap-1");
  });

  it("ignores album order when comparing scope", () => {
    expect(find([snapshot({ album_ids: ["a2", "a1"] })])?.id).toBe("snap-1");
  });

  it("does not reuse a capture of a different album set", () => {
    expect(find([snapshot({ album_ids: ["a1"] })])).toBeNull();
    expect(find([snapshot({ album_ids: ["a1", "a2", "a3"] })])).toBeNull();
  });

  it("does not reuse a capture older than the window", () => {
    expect(find([snapshot({ created_at: "2026-07-30T14:00:00.000Z" })])).toBeNull();
  });

  it("does not reuse a failed capture", () => {
    expect(find([snapshot({ state: "failed" })])).toBeNull();
  });

  // A queued capture is still the right thing to hand back: the caller polls
  // for measurements either way, and starting a second scrape is the waste.
  it("reuses a capture that is still in flight", () => {
    expect(find([snapshot({ state: "queued" })])?.id).toBe("snap-1");
  });

  it("does not reuse across platforms", () => {
    expect(find([snapshot({ platforms: ["apple"] })])).toBeNull();
  });

  it("does not reuse a scheduled run for a one-off request", () => {
    expect(find([snapshot({ schedule: "monthly" })])).toBeNull();
  });

  it("prefers the newest eligible capture", () => {
    const older = snapshot({ id: "old", created_at: "2026-07-30T14:25:00.000Z" });
    const newer = snapshot({ id: "new", created_at: "2026-07-30T14:31:00.000Z" });
    expect(find([older, newer])?.id).toBe("new");
  });

  it("returns null when nothing matches", () => {
    expect(find([])).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { pickCanonicalSnapshot } from "@/lib/research/playcounts/pickCanonicalSnapshot";
import type { Tables } from "@/types/database.types";

const row = (over: Partial<Tables<"playcount_snapshots">>) =>
  ({
    id: "b",
    created_at: "2026-07-30T12:00:00.000Z",
    ...over,
  }) as Tables<"playcount_snapshots">;

describe("pickCanonicalSnapshot", () => {
  // chat#1912 row 7. Two simultaneous identical requests both insert before
  // either can see the other, so the pre-check cannot help. Both then re-read
  // and must independently agree on the same winner, or they both scrape.
  it("picks the earliest claim", () => {
    const winner = row({ id: "late", created_at: "2026-07-30T12:00:05.000Z" });
    const early = row({ id: "early", created_at: "2026-07-30T12:00:01.000Z" });

    expect(pickCanonicalSnapshot([winner, early])?.id).toBe("early");
  });

  // Same-millisecond inserts are the whole point of this function, so the
  // tie-break must be total and identical for every caller.
  it("breaks an exact timestamp tie by id, deterministically", () => {
    const a = row({ id: "aaa", created_at: "2026-07-30T12:00:00.000Z" });
    const b = row({ id: "bbb", created_at: "2026-07-30T12:00:00.000Z" });

    expect(pickCanonicalSnapshot([a, b])?.id).toBe("aaa");
    // Order of the input must not change the answer, or the two racers disagree.
    expect(pickCanonicalSnapshot([b, a])?.id).toBe("aaa");
  });

  it("returns the only claim when there is no race", () => {
    expect(pickCanonicalSnapshot([row({ id: "solo" })])?.id).toBe("solo");
  });

  it("returns null for no claims", () => {
    expect(pickCanonicalSnapshot([])).toBeNull();
  });

  it("ignores claims with no timestamp rather than crowning them", () => {
    const dated = row({ id: "dated", created_at: "2026-07-30T12:00:09.000Z" });
    const undatedRow = row({ id: "aaa", created_at: null });

    expect(pickCanonicalSnapshot([undatedRow, dated])?.id).toBe("dated");
  });
});

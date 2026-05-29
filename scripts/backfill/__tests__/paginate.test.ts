import { describe, it, expect, vi } from "vitest";
import { paginate } from "@/scripts/backfill/paginate";

describe("paginate", () => {
  it("stops after a single page when it is not full (< PAGE_SIZE)", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce([1, 2, 3]);

    const rows = await paginate<number>(fetchPage);

    expect(rows).toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, 999);
  });

  it("keeps paging while pages are full, advancing the range each time", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => i);
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(full) // page 1 — full, keep going
      .mockResolvedValueOnce([1000, 1001]); // page 2 — short, stop

    const rows = await paginate<number>(fetchPage);

    expect(rows).toHaveLength(1002);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 999);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("returns an empty array and queries once when the first page is empty", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce([]);

    const rows = await paginate<number>(fetchPage);

    expect(rows).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

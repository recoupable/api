import { describe, it, expect, vi, beforeEach } from "vitest";
import { countApifyRunDescendants } from "../countApifyRunDescendants";
import { selectApifyScraperRunIdsByParent } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRunIdsByParent";

vi.mock("@/lib/supabase/apify_scraper_runs/selectApifyScraperRunIdsByParent", () => ({
  selectApifyScraperRunIdsByParent: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("countApifyRunDescendants", () => {
  it("sums every generation under the root: 1 comments run + 1 fan batch = 2", async () => {
    vi.mocked(selectApifyScraperRunIdsByParent)
      .mockResolvedValueOnce(["comments"])
      .mockResolvedValueOnce(["fans"])
      .mockResolvedValueOnce([]);
    expect(await countApifyRunDescendants("root", 50)).toBe(2);
    expect(selectApifyScraperRunIdsByParent).toHaveBeenNthCalledWith(1, ["root"]);
    expect(selectApifyScraperRunIdsByParent).toHaveBeenNthCalledWith(2, ["comments"]);
    expect(selectApifyScraperRunIdsByParent).toHaveBeenNthCalledWith(3, ["fans"]);
  });

  it("stops at a bounded depth so a pathological chain cannot recurse forever", async () => {
    vi.mocked(selectApifyScraperRunIdsByParent).mockResolvedValue(["x"]);
    expect(await countApifyRunDescendants("root", 50)).toBe(5);
    expect(vi.mocked(selectApifyScraperRunIdsByParent).mock.calls).toHaveLength(5);
  });

  it("returns 0 for a root with no children", async () => {
    vi.mocked(selectApifyScraperRunIdsByParent).mockResolvedValue([]);
    expect(await countApifyRunDescendants("root", 50)).toBe(0);
  });

  it("stops walking once the cap is reached and never queries past it", async () => {
    const wide = Array.from({ length: 80 }, (_, i) => `run-${i}`);
    vi.mocked(selectApifyScraperRunIdsByParent).mockResolvedValue(wide);
    expect(await countApifyRunDescendants("root", 50)).toBe(50);
    expect(selectApifyScraperRunIdsByParent).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectSocialFans } from "../selectSocialFans";

const mockFrom = vi.fn();

vi.mock("../../serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("selectSocialFans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits without calling supabase when social_ids is an empty array", async () => {
    const result = await selectSocialFans({ social_ids: [] });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual({ rows: [], totalCount: 0 });
  });

  it("hits the DB when social_ids is undefined (no filter)", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      then: (resolve: (v: { data: unknown[]; error: null; count: number }) => void) =>
        resolve({ data: [], error: null, count: 0 }),
    };
    mockFrom.mockReturnValue(builder);

    await selectSocialFans({});

    expect(mockFrom).toHaveBeenCalledWith("social_fans");
    expect(builder.in).not.toHaveBeenCalled();
  });

  it("hits the DB and filters when social_ids is non-empty", async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      then: (resolve: (v: { data: unknown[]; error: null; count: number }) => void) =>
        resolve({ data: [], error: null, count: 0 }),
    };
    mockFrom.mockReturnValue(builder);

    await selectSocialFans({ social_ids: ["s1", "s2"] });

    expect(mockFrom).toHaveBeenCalledWith("social_fans");
    expect(builder.in).toHaveBeenCalledWith("artist_social_id", ["s1", "s2"]);
  });
});

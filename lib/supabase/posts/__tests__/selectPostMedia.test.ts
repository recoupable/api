import { describe, it, expect, vi, beforeEach } from "vitest";
import supabase from "../../serverClient";
import { selectPostMedia } from "../selectPostMedia";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));

const COLUMNS = "id, caption, published_at, media, media_observed_at";
const ROW = {
  id: "p1",
  caption: "studio week two",
  published_at: "2026-08-20T00:00:00+00:00",
  media: [
    {
      position: 0,
      kind: "image",
      provider_url: "https://cdn.example/a.jpg",
      width: 1080,
      height: 1350,
      alt: null,
      source: "apify_instagram",
    },
  ],
  media_observed_at: "2026-10-10T12:00:00+00:00",
};

type Result<T> = { data: T; error: { message: string } | null };

function mockChain<T>(result: Result<T>) {
  const inFn = vi.fn().mockReturnValue({ then: (fn: (r: Result<T>) => unknown) => fn(result) });
  const select = vi.fn().mockReturnValue({ in: inFn });
  vi.mocked(supabase.from).mockReturnValueOnce({ select } as never);
  return { select, in: inFn };
}

describe("selectPostMedia", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads only the retention columns for the given post ids", async () => {
    const m = mockChain({
      data: [ROW, { ...ROW, id: "p2", caption: null, media: [] }],
      error: null,
    });

    const rows = await selectPostMedia({ postIds: ["p1", "p2"] });

    expect(supabase.from).toHaveBeenCalledWith("posts");
    expect(m.select).toHaveBeenCalledWith(COLUMNS);
    expect(m.in).toHaveBeenCalledWith("id", ["p1", "p2"]);
    expect(rows).toEqual([ROW, { ...ROW, id: "p2", caption: null, media: [] }]);
  });

  it("returns an empty list without querying when no ids are given", async () => {
    expect(await selectPostMedia({ postIds: [] })).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("throws when the query errors", async () => {
    mockChain({ data: null as unknown as (typeof ROW)[], error: { message: "boom" } });
    await expect(selectPostMedia({ postIds: ["p1"] })).rejects.toThrow(
      /Failed to fetch post media/,
    );
  });
});

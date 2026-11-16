import { beforeEach, expect, it, vi } from "vitest";
import { upsertPosts } from "../upsertPosts";
import { mapInstagramPostsToRows } from "@/lib/apify/instagram/mapInstagramPostsToRows";

const intercepted = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../serverClient", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    default: createClient("https://fixture.invalid", "synthetic-only-key", {
      global: { fetch: intercepted.fetch },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  };
});
beforeEach(() => {
  intercepted.fetch.mockReset();
  intercepted.fetch.mockResolvedValue(new Response(null, { status: 201 }));
});
function requests() {
  return intercepted.fetch.mock.calls.map(([url, init]) => ({
    url: new URL(String(url)),
    headers: new Headers(init.headers),
    rows: JSON.parse(init.body as string) as Record<string, unknown>[],
  }));
}

it("does not serialize missing count columns for heterogeneous current Instagram rows", async () => {
  const rows = mapInstagramPostsToRows([
    { url: "post-a", likesCount: 5, commentsCount: 2 },
    { url: "post-b", commentsCount: 0 },
  ]);
  expect(await upsertPosts(rows)).toEqual({ data: null, error: null });
  const stored: Record<string, Record<string, unknown>> = {
    "post-a": { likes: 1, comments: 1 },
    "post-b": { likes: 99, comments: 8 },
  };
  for (const request of requests()) {
    expect(request.url.searchParams.get("on_conflict")).toBe("post_url");
    expect(request.headers.get("Prefer")).toContain("resolution=merge-duplicates");
    expect(request.headers.get("Prefer")).not.toContain("return=representation");
    const columns = request.url.searchParams
      .get("columns")!
      .split(",")
      .map(key => key.replaceAll('"', ""));
    for (const row of request.rows) {
      // Independent wire invariant: PostgREST's union must not include a field absent on this row.
      for (const column of columns)
        expect(Object.hasOwn(row, column), `${row.post_url} missing ${column}`).toBe(true);
      // Synthetic application of documented missing-column behavior, not a database test.
      for (const column of columns) stored[String(row.post_url)][column] = row[column] ?? null;
    }
  }
  expect(stored["post-b"]).toMatchObject({ likes: 99, comments: 0 });
});

it("batches matching columns regardless of key order, preserving zero and stripping nullish values", async () => {
  const rows = [
    { post_url: "a", likes: 0, views: null },
    { likes: 4, post_url: "b", comments: undefined },
  ];
  expect(await upsertPosts(rows)).toEqual({ data: null, error: null });
  expect(requests()).toHaveLength(1);
  expect(requests()[0].rows).toEqual([
    { post_url: "a", likes: 0 },
    { likes: 4, post_url: "b" },
  ]);
  expect(rows[0].views).toBeNull();
});

it("preserves input order even when a column shape recurs after another shape", async () => {
  await upsertPosts([
    { post_url: "a", likes: 1 },
    { post_url: "b", views: 2 },
    { post_url: "c", likes: 3 },
  ]);
  expect(requests().flatMap(request => request.rows.map(row => row.post_url))).toEqual([
    "a",
    "b",
    "c",
  ]);
  for (const request of requests()) {
    const sets = request.rows.map(row => Object.keys(row).sort().join(","));
    expect(new Set(sets).size).toBe(1);
  }
});

it.each([
  {
    rows: [
      { post_url: "same", likes: 1 },
      { post_url: "same", views: 2 },
    ],
  },
  {
    rows: [
      { post_url: "same", likes: 1 },
      { post_url: "same", likes: 2 },
    ],
  },
])(
  "rejects duplicate targets before any partial write instead of inventing overwrite order",
  async ({ rows }) => {
    await expect(upsertPosts(rows)).rejects.toThrow("Duplicate post_url");
    expect(intercepted.fetch).not.toHaveBeenCalled();
  },
);

it("returns the existing minimal result shape for an empty no-op without a request", async () => {
  expect(await upsertPosts([])).toEqual({ data: null, error: null });
  expect(intercepted.fetch).not.toHaveBeenCalled();
});

it("stops on the first SDK error after prior writes and neither rolls back nor retries", async () => {
  const failure = { code: "42501", message: "synthetic denial", details: null, hint: null };
  intercepted.fetch.mockImplementation(async (_url, init) => {
    const rows = JSON.parse(init.body as string);
    return rows[0].post_url === "b"
      ? new Response(JSON.stringify(failure), { status: 403 })
      : new Response(null, { status: 201 });
  });
  await expect(
    upsertPosts([
      { post_url: "a", likes: 1 },
      { post_url: "b", views: 2 },
      { post_url: "c", comments: 3 },
    ]),
  ).rejects.toEqual(failure);
  expect(requests().flatMap(request => request.rows.map(row => row.post_url))).toEqual(["a", "b"]);
});

import Ajv from "ajv";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/comments/route";
import fixture from "../fixtures/published-docs.json";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    default: createClient("https://fixture.invalid", "dummy-fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: mocks.fetch },
    }),
  };
});
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: "caller_fixture" })),
}));
vi.mock("@/lib/comments/canReadCreatorComments", () => ({
  canReadCreatorComments: vi.fn(async () => true),
}));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: vi.fn(async () => [{ id: "11111111-1111-4111-8111-111111111111" }]),
}));
vi.mock("@/lib/supabase/account_socials/selectAccountSocialIds", () => ({
  selectAccountSocialIds: vi.fn(async () => ["creator_a", "creator_b"]),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const post = "22222222-2222-4222-8222-222222222222";
const request = () =>
  new NextRequest(
    `https://fixture.invalid/api/comments?artist_account_id=11111111-1111-4111-8111-111111111111&post_id=${post}&page=3&limit=10`,
    { headers: { "x-api-key": "dummy" } },
  );
const rangeFailure = (code = "PGRST103") =>
  new Response(
    JSON.stringify({
      code,
      details: "synthetic out-of-range page",
      hint: null,
      message: "Requested range not satisfiable",
    }),
    { status: 416, headers: { "content-type": "application/json", "content-range": "*/12" } },
  );

beforeEach(() => vi.resetAllMocks());

function checkScopedRetry() {
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  for (const [raw, options] of mocks.fetch.mock.calls) {
    const url = new URL(String(raw));
    expect(url.origin).toBe("https://fixture.invalid");
    expect(url.searchParams.get("posts.social_posts.social_id")).toBe("in.(creator_a,creator_b)");
    expect(url.searchParams.get("post_id")).toBe(`eq.${post}`);
    expect(new Headers(options.headers).get("prefer")).toContain("count=exact");
  }
  const [raw, options] = mocks.fetch.mock.calls[1];
  expect(options.method).toBe("HEAD");
  expect(new URL(String(raw)).searchParams.has("offset")).toBe(false);
  expect(new URL(String(raw)).searchParams.has("limit")).toBe(false);
}

describe("published empty-page contract through real SDK with HTTP stubs", () => {
  it("returns an empty beyond-final page with the same scoped count", async () => {
    mocks.fetch
      .mockResolvedValueOnce(rangeFailure())
      .mockResolvedValueOnce(
        new Response(null, { status: 200, headers: { "content-range": "*/12" } }),
      );
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      comments: [],
      pagination: { total_count: 12, page: 3, limit: 10, total_pages: 2 },
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const validate = new Ajv({ strict: false, validateFormats: false }).compile(
      fixture.storedComments.schemas["200"],
    );
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    checkScopedRetry();
  });

  it.each(["missing-count", "count-failure"])(
    "keeps %s as a masked failure, not an invented zero",
    async scenario => {
      const count =
        scenario === "missing-count"
          ? new Response(null, { status: 200 })
          : new Response(
              JSON.stringify({
                code: "FIXTURE_COUNT_ERROR",
                message: "private_fixture_count_detail",
              }),
              { status: 500, headers: { "content-type": "application/json" } },
            );
      mocks.fetch.mockResolvedValueOnce(rangeFailure()).mockResolvedValueOnce(count);
      const response = await GET(request());
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(body).toEqual({ status: "error", error: "Internal server error" });
      expect(JSON.stringify(body)).not.toContain("private_fixture_count_detail");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const validate = new Ajv({ strict: false }).compile(fixture.storedComments.schemas["500"]);
      expect(validate(body)).toBe(true);
      checkScopedRetry();
    },
  );

  it("does not reinterpret unrelated backend errors as empty results", async () => {
    mocks.fetch.mockResolvedValueOnce(rangeFailure("FIXTURE_OTHER_ERROR"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", error: "Internal server error" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetInstagramCommentsRequest } from "../validateGetInstagramCommentsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const ACCOUNT_ID = "660e8400-e29b-41d4-a716-446655440000";
const authResult = { accountId: ACCOUNT_ID, authToken: "t", orgId: null };

const makeRequest = (query: string) =>
  new NextRequest(`http://localhost/api/instagram/comments${query}`, {
    headers: { "x-api-key": "k" },
  });

const WEBHOOKS_JSON = JSON.stringify([
  { eventTypes: ["ACTOR.RUN.SUCCEEDED"], requestUrl: "https://example.com/hook" },
]);
const WEBHOOKS_B64 = Buffer.from(WEBHOOKS_JSON, "utf-8").toString("base64");

const POST_URL = "https://instagram.com/p/abc";
const POST_URL_ENC = encodeURIComponent(POST_URL);

describe("validateGetInstagramCommentsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authResult);
  });

  it("propagates 401 from validateAuthContext", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);
    expect(
      await validateGetInstagramCommentsRequest(makeRequest(`?postUrls=${POST_URL_ENC}`)),
    ).toBe(err);
  });

  it.each([
    ["no postUrls", ""],
    ["empty postUrls value", "?postUrls="],
    ["resultsLimit not a number", `?postUrls=${POST_URL_ENC}&resultsLimit=abc`],
    ["resultsLimit zero", `?postUrls=${POST_URL_ENC}&resultsLimit=0`],
    ["isNewestComments not boolean-string", `?postUrls=${POST_URL_ENC}&isNewestComments=maybe`],
  ])("returns 400 when %s", async (_, query) => {
    const res = (await validateGetInstagramCommentsRequest(makeRequest(query))) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("returns 400 when webhooks is not base64 JSON", async () => {
    const res = (await validateGetInstagramCommentsRequest(
      makeRequest(`?postUrls=${POST_URL_ENC}&webhooks=%%%not-b64`),
    )) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("returns 400 when webhooks decodes to non-array", async () => {
    const b64 = Buffer.from(JSON.stringify({ foo: 1 }), "utf-8").toString("base64");
    const res = (await validateGetInstagramCommentsRequest(
      makeRequest(`?postUrls=${POST_URL_ENC}&webhooks=${encodeURIComponent(b64)}`),
    )) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("returns postUrls with default resultsLimit when no resultsLimit provided", async () => {
    const result = await validateGetInstagramCommentsRequest(
      makeRequest(`?postUrls=${POST_URL_ENC}`),
    );
    expect(result).toEqual({ postUrls: [POST_URL], resultsLimit: 10000 });
  });

  it("coerces resultsLimit from query string", async () => {
    const result = await validateGetInstagramCommentsRequest(
      makeRequest(`?postUrls=${POST_URL_ENC}&resultsLimit=50`),
    );
    expect(result).toEqual({ postUrls: [POST_URL], resultsLimit: 50 });
  });

  it("parses isNewestComments=true", async () => {
    const result = await validateGetInstagramCommentsRequest(
      makeRequest(`?postUrls=${POST_URL_ENC}&isNewestComments=true`),
    );
    expect(result).toEqual({ postUrls: [POST_URL], resultsLimit: 10000, isNewestComments: true });
  });

  it("returns decoded webhooks on happy path", async () => {
    const result = await validateGetInstagramCommentsRequest(
      makeRequest(`?postUrls=${POST_URL_ENC}&webhooks=${encodeURIComponent(WEBHOOKS_B64)}`),
    );
    expect(result).toEqual({
      postUrls: [POST_URL],
      resultsLimit: 10000,
      webhooks: [{ eventTypes: ["ACTOR.RUN.SUCCEEDED"], requestUrl: "https://example.com/hook" }],
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetInstagramProfilesRequest } from "../validateGetInstagramProfilesRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const ACCOUNT_ID = "660e8400-e29b-41d4-a716-446655440000";
const authResult = { accountId: ACCOUNT_ID, authToken: "t", orgId: null };

const makeRequest = (query: string) =>
  new NextRequest(`http://localhost/api/instagram/profiles${query}`, {
    headers: { "x-api-key": "k" },
  });

const WEBHOOKS_JSON = JSON.stringify([
  { eventTypes: ["ACTOR.RUN.SUCCEEDED"], requestUrl: "https://example.com/hook" },
]);
const WEBHOOKS_B64 = Buffer.from(WEBHOOKS_JSON, "utf-8").toString("base64");

describe("validateGetInstagramProfilesRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue(authResult);
  });

  it("propagates 401 from validateAuthContext", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);
    expect(await validateGetInstagramProfilesRequest(makeRequest("?handles=a"))).toBe(err);
  });

  it.each([
    ["no handles", ""],
    ["empty handle", "?handles="],
  ])("returns 400 when %s", async (_, query) => {
    const res = (await validateGetInstagramProfilesRequest(makeRequest(query))) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("returns 400 when webhooks is not base64 JSON", async () => {
    const res = (await validateGetInstagramProfilesRequest(
      makeRequest("?handles=a&webhooks=%%%not-b64"),
    )) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("returns 400 when webhooks decodes to non-array", async () => {
    const b64 = Buffer.from(JSON.stringify({ foo: 1 }), "utf-8").toString("base64");
    const res = (await validateGetInstagramProfilesRequest(
      makeRequest(`?handles=a&webhooks=${encodeURIComponent(b64)}`),
    )) as NextResponse;
    expect(res.status).toBe(400);
  });

  it("returns handles without webhooks when webhooks param is absent", async () => {
    expect(await validateGetInstagramProfilesRequest(makeRequest("?handles=a&handles=b"))).toEqual({
      handles: ["a", "b"],
    });
  });

  it("returns decoded webhooks on happy path", async () => {
    const result = await validateGetInstagramProfilesRequest(
      makeRequest(`?handles=a&webhooks=${encodeURIComponent(WEBHOOKS_B64)}`),
    );
    expect(result).toEqual({
      handles: ["a"],
      webhooks: [{ eventTypes: ["ACTOR.RUN.SUCCEEDED"], requestUrl: "https://example.com/hook" }],
    });
  });
});

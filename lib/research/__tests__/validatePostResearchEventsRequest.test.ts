import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validatePostResearchEventsRequest } from "../validatePostResearchEventsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { ensureEventsResearchCredits } from "../ensureEventsResearchCredits";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("../ensureEventsResearchCredits", () => ({
  ensureEventsResearchCredits: vi.fn(),
}));

const ARTIST_ID = "123694f2-1dab-40b4-8a75-84d39571c0bc";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/research/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("validatePostResearchEventsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acct-1",
      orgId: null,
    } as never);
    vi.mocked(ensureEventsResearchCredits).mockResolvedValue(null as never);
  });

  it("returns the auth response when auth fails", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(unauthorized as never);

    const result = await validatePostResearchEventsRequest(req({ artist_id: ARTIST_ID }));

    expect(result).toBe(unauthorized);
  });

  it("accepts a uuid artist_id and carries the auth scope through", async () => {
    const result = await validatePostResearchEventsRequest(req({ artist_id: ARTIST_ID }));

    expect(result).toEqual({ accountId: "acct-1", orgId: null, artist_id: ARTIST_ID });
  });

  it("passes the org scope through so the handler can scope the roster lookup", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acct-1",
      orgId: "org-9",
    } as never);

    const result = await validatePostResearchEventsRequest(req({ artist_id: ARTIST_ID }));

    expect(result).toMatchObject({ orgId: "org-9" });
  });

  it("accepts an explicit date filter", async () => {
    const result = await validatePostResearchEventsRequest(
      req({ artist_id: ARTIST_ID, date: "past" }),
    );

    expect(result).toMatchObject({ artist_id: ARTIST_ID, date: "past" });
  });

  // A provider id is no longer part of the contract; only a Recoup uuid is valid.
  it.each(["1590132", "Loreen", "", "not-a-uuid", "123694f2-1dab-40b4-8a75"])(
    "rejects a non-uuid artist_id %j with a 400",
    async value => {
      const result = await validatePostResearchEventsRequest(req({ artist_id: value }));

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    },
  );

  it("rejects a missing artist_id with a 400", async () => {
    const result = await validatePostResearchEventsRequest(req({}));

    expect((result as NextResponse).status).toBe(400);
  });

  it("rejects a bandsintown_id-only body with a 400", async () => {
    const result = await validatePostResearchEventsRequest(req({ bandsintown_id: "1590132" }));

    expect((result as NextResponse).status).toBe(400);
  });

  it("rejects an unknown date value with a 400", async () => {
    const result = await validatePostResearchEventsRequest(
      req({ artist_id: ARTIST_ID, date: "tomorrow" }),
    );

    expect((result as NextResponse).status).toBe(400);
  });

  it("returns the credit short-circuit (402) when the account is short", async () => {
    const paymentRequired = NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    vi.mocked(ensureEventsResearchCredits).mockResolvedValue(paymentRequired as never);

    const result = await validatePostResearchEventsRequest(req({ artist_id: ARTIST_ID }));

    expect(result).toBe(paymentRequired);
  });
});

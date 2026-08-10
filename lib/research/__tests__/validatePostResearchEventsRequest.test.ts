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

function req(body: unknown) {
  return new NextRequest("http://localhost/api/research/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("validatePostResearchEventsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acct-1" } as never);
    vi.mocked(ensureEventsResearchCredits).mockResolvedValue(null as never);
  });

  it("returns the auth response when auth fails", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(unauthorized as never);

    const result = await validatePostResearchEventsRequest(req({ bandsintown_id: "1590132" }));

    expect(result).toBe(unauthorized);
  });

  it("accepts a numeric id and defaults date to undefined", async () => {
    const result = await validatePostResearchEventsRequest(req({ bandsintown_id: "1590132" }));

    expect(result).toEqual({ accountId: "acct-1", bandsintown_id: "1590132" });
  });

  it("accepts an explicit date filter", async () => {
    const result = await validatePostResearchEventsRequest(
      req({ bandsintown_id: "1590132", date: "past" }),
    );

    expect(result).toEqual({ accountId: "acct-1", bandsintown_id: "1590132", date: "past" });
  });

  // The endpoint exists to remove name-based ambiguity; accepting a name here
  // would reintroduce exactly the bug it was built to prevent.
  it.each(["Loreen", "micky-dolenz", "", "1590132abc", "a1590132"])(
    "rejects non-numeric bandsintown_id %j with a 400",
    async value => {
      const result = await validatePostResearchEventsRequest(req({ bandsintown_id: value }));

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    },
  );

  it("rejects a missing bandsintown_id with a 400", async () => {
    const result = await validatePostResearchEventsRequest(req({}));

    expect((result as NextResponse).status).toBe(400);
  });

  it("rejects an unknown date value with a 400", async () => {
    const result = await validatePostResearchEventsRequest(
      req({ bandsintown_id: "1590132", date: "tomorrow" }),
    );

    expect((result as NextResponse).status).toBe(400);
  });

  it("returns the credit short-circuit (402) when the account is short", async () => {
    const paymentRequired = NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
    vi.mocked(ensureEventsResearchCredits).mockResolvedValue(paymentRequired as never);

    const result = await validatePostResearchEventsRequest(req({ bandsintown_id: "1590132" }));

    expect(result).toBe(paymentRequired);
  });
});

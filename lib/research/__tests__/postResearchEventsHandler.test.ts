import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { postResearchEventsHandler } from "../postResearchEventsHandler";
import { validatePostResearchEventsRequest } from "../validatePostResearchEventsRequest";
import { fetchBandsintownEvents } from "@/lib/apify/bandsintown/fetchBandsintownEvents";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validatePostResearchEventsRequest", () => ({
  validatePostResearchEventsRequest: vi.fn(),
}));

vi.mock("@/lib/apify/bandsintown/fetchBandsintownEvents", () => ({
  fetchBandsintownEvents: vi.fn(),
}));

vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: vi.fn(),
}));

const EVENT = {
  date: "2026-09-26",
  venue: "O2 Academy Brixton",
  city: "London",
  region: "",
  country: "United Kingdom",
  ticket_url: "https://www.bandsintown.com/t/108011396",
  sold_out: false,
  lineup: ["Loreen"],
};

function req(body: unknown) {
  return new NextRequest("http://localhost/api/research/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("postResearchEventsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the validator's error response (e.g. 401)", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue(err);

    const res = await postResearchEventsHandler(req({ bandsintown_id: "1590132" }));

    expect(res).toBe(err);
    expect(fetchBandsintownEvents).not.toHaveBeenCalled();
  });

  it("returns the validator's 400 when the body is invalid", async () => {
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue(
      NextResponse.json({ error: "bad" }, { status: 400 }),
    );

    const res = await postResearchEventsHandler(req({}));

    expect(res.status).toBe(400);
  });

  it("returns 200 with events on success", async () => {
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue({
      accountId: "acct-1",
      bandsintown_id: "1590132",
      date: "upcoming",
    });
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([EVENT]);

    const res = await postResearchEventsHandler(req({ bandsintown_id: "1590132" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "success", events: [EVENT] });
    expect(fetchBandsintownEvents).toHaveBeenCalledWith({
      bandsintownId: "1590132",
      date: "upcoming",
    });
  });

  it("returns 200 with an empty array when the artist has no events", async () => {
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue({
      accountId: "acct-1",
      bandsintown_id: "66728",
      date: "upcoming",
    });
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([]);

    const res = await postResearchEventsHandler(req({ bandsintown_id: "66728" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "success", events: [] });
  });

  it("deducts a credit on success", async () => {
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue({
      accountId: "acct-1",
      bandsintown_id: "1590132",
      date: "upcoming",
    });
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([EVENT]);

    await postResearchEventsHandler(req({ bandsintown_id: "1590132" }));

    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acct-1",
      creditsToDeduct: 1,
      source: "api",
    });
  });

  it("still returns the data when credit deduction fails", async () => {
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue({
      accountId: "acct-1",
      bandsintown_id: "1590132",
      date: "upcoming",
    });
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([EVENT]);
    vi.mocked(recordCreditDeduction).mockRejectedValue(new Error("ledger down"));

    const res = await postResearchEventsHandler(req({ bandsintown_id: "1590132" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", events: [EVENT] });
  });

  it("returns 500 when the actor run fails", async () => {
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue({
      accountId: "acct-1",
      bandsintown_id: "1590132",
      date: "upcoming",
    });
    vi.mocked(fetchBandsintownEvents).mockRejectedValue(
      new Error("Bandsintown actor run failed with status FAILED"),
    );

    const res = await postResearchEventsHandler(req({ bandsintown_id: "1590132" }));

    expect(res.status).toBe(500);
    expect((await res.json()).status).toBe("error");
  });

  it("does not deduct a credit when the fetch fails", async () => {
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue({
      accountId: "acct-1",
      bandsintown_id: "1590132",
      date: "upcoming",
    });
    vi.mocked(fetchBandsintownEvents).mockRejectedValue(new Error("boom"));

    await postResearchEventsHandler(req({ bandsintown_id: "1590132" }));

    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });
});

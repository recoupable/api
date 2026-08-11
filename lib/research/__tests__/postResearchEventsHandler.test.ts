import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { postResearchEventsHandler } from "../postResearchEventsHandler";
import { validatePostResearchEventsRequest } from "../validatePostResearchEventsRequest";
import { getArtists } from "@/lib/artists/getArtists";
import { getArtistBandsintownId } from "../getArtistBandsintownId";
import { fetchBandsintownEvents } from "@/lib/apify/bandsintown/fetchBandsintownEvents";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validatePostResearchEventsRequest", () => ({
  validatePostResearchEventsRequest: vi.fn(),
}));

vi.mock("@/lib/artists/getArtists", () => ({ getArtists: vi.fn() }));
vi.mock("../getArtistBandsintownId", () => ({ getArtistBandsintownId: vi.fn() }));
vi.mock("@/lib/apify/bandsintown/fetchBandsintownEvents", () => ({
  fetchBandsintownEvents: vi.fn(),
}));
vi.mock("@/lib/credits/recordCreditDeduction", () => ({ recordCreditDeduction: vi.fn() }));

const ARTIST_ID = "123694f2-1dab-40b4-8a75-84d39571c0bc";

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

/** Default happy-path wiring; individual tests override the piece they exercise. */
function wireValid() {
  vi.mocked(validatePostResearchEventsRequest).mockResolvedValue({
    accountId: "acct-1",
    orgId: null,
    artist_id: ARTIST_ID,
  });
  vi.mocked(getArtists).mockResolvedValue([{ account_id: ARTIST_ID }] as never);
  vi.mocked(getArtistBandsintownId).mockResolvedValue("1590132");
}

describe("postResearchEventsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the validator's error response (e.g. 401)", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue(err);

    const res = await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));

    expect(res).toBe(err);
    expect(fetchBandsintownEvents).not.toHaveBeenCalled();
  });

  // Without this, any authenticated account could read any artist's profile.
  it("returns 404 when the artist is not in the caller's roster", async () => {
    wireValid();
    vi.mocked(getArtists).mockResolvedValue([{ account_id: "someone-elses-artist" }] as never);

    const res = await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));

    expect(res.status).toBe(404);
    expect(getArtistBandsintownId).not.toHaveBeenCalled();
    expect(fetchBandsintownEvents).not.toHaveBeenCalled();
  });

  // getArtists treats orgId null as "personal only, EXCLUDING org artists" and
  // orgId undefined as "personal + all orgs". Passing null therefore 404s every
  // artist that lives in an organization, which is most customer rosters.
  it("omits orgId entirely when the auth context carries none", async () => {
    wireValid();
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([]);

    await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));

    expect(getArtists).toHaveBeenCalledWith({ accountId: "acct-1" });
    const call = vi.mocked(getArtists).mock.calls[0][0];
    expect("orgId" in call).toBe(false);
  });

  it("scopes the roster lookup to the caller's account and org", async () => {
    wireValid();
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue({
      accountId: "acct-1",
      orgId: "org-9",
      artist_id: ARTIST_ID,
    });
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([]);

    await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));

    expect(getArtists).toHaveBeenCalledWith({ accountId: "acct-1", orgId: "org-9" });
  });

  it("returns 404 with connection instructions when no bandsintown id is connected", async () => {
    wireValid();
    vi.mocked(getArtistBandsintownId).mockResolvedValue(null);

    const res = await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe(
      "Error: no bandsintown ID connected to this artist. " +
        "Please connect the bandsintown ID in this format: bandsintown.com/a/{id}-{slug} " +
        "Docs here: https://docs.recoupable.dev/api-reference/artists/update#body-profile-urls",
    );
    expect(fetchBandsintownEvents).not.toHaveBeenCalled();
  });

  it("returns 200 with events on success", async () => {
    wireValid();
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([EVENT]);

    const res = await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", events: [EVENT] });
    expect(fetchBandsintownEvents).toHaveBeenCalledWith({ bandsintownId: "1590132" });
  });

  // The distinction that matters: "connected but not touring" must never be
  // reported the same way as "we have no source for this artist".
  it("returns 200 with an empty array — NOT 404 — when connected but not touring", async () => {
    wireValid();
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([]);

    const res = await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", events: [] });
  });

  it("forwards the date filter when provided", async () => {
    wireValid();
    vi.mocked(validatePostResearchEventsRequest).mockResolvedValue({
      accountId: "acct-1",
      orgId: null,
      artist_id: ARTIST_ID,
      date: "past",
    });
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([]);

    await postResearchEventsHandler(req({ artist_id: ARTIST_ID, date: "past" }));

    expect(fetchBandsintownEvents).toHaveBeenCalledWith({
      bandsintownId: "1590132",
      date: "past",
    });
  });

  it("deducts a credit on success", async () => {
    wireValid();
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([EVENT]);

    await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));

    expect(recordCreditDeduction).toHaveBeenCalledWith({
      accountId: "acct-1",
      creditsToDeduct: 1,
      source: "api",
    });
  });

  it("still returns the data when credit deduction fails", async () => {
    wireValid();
    vi.mocked(fetchBandsintownEvents).mockResolvedValue([EVENT]);
    vi.mocked(recordCreditDeduction).mockRejectedValue(new Error("ledger down"));

    const res = await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success", events: [EVENT] });
  });

  it("does not deduct a credit when the artist has no bandsintown id", async () => {
    wireValid();
    vi.mocked(getArtistBandsintownId).mockResolvedValue(null);

    await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));

    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });

  it("returns 500 when the actor run fails", async () => {
    wireValid();
    vi.mocked(fetchBandsintownEvents).mockRejectedValue(
      new Error("Bandsintown actor run failed with status FAILED"),
    );

    const res = await postResearchEventsHandler(req({ artist_id: ARTIST_ID }));

    expect(res.status).toBe(500);
    expect((await res.json()).status).toBe("error");
    expect(recordCreditDeduction).not.toHaveBeenCalled();
  });
});

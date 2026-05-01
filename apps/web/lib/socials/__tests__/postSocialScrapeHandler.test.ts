import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { postSocialScrapeHandler } from "../postSocialScrapeHandler";
import { validatePostSocialScrapeRequest } from "../validatePostSocialScrapeRequest";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";
import { scrapeProfileUrl } from "@/lib/apify/scrapeProfileUrl";

vi.mock("../validatePostSocialScrapeRequest", () => ({
  validatePostSocialScrapeRequest: vi.fn(),
}));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: vi.fn() }));
vi.mock("@/lib/apify/scrapeProfileUrl", () => ({ scrapeProfileUrl: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const SOCIAL_ID = "550e8400-e29b-41d4-a716-446655440000";
const request = new NextRequest(`http://localhost/api/socials/${SOCIAL_ID}/scrape`, {
  method: "POST",
});
const validated = { social_id: SOCIAL_ID };
const social = { id: SOCIAL_ID, profile_url: "https://x.com/a", username: "a" };

describe("postSocialScrapeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validatePostSocialScrapeRequest).mockResolvedValue(validated);
    vi.mocked(selectSocials).mockResolvedValue([social as never]);
  });

  it("returns the validator's response on failure", async () => {
    const err = NextResponse.json({}, { status: 401 });
    vi.mocked(validatePostSocialScrapeRequest).mockResolvedValue(err);
    expect(await postSocialScrapeHandler(request, SOCIAL_ID)).toBe(err);
    expect(selectSocials).not.toHaveBeenCalled();
  });

  it("returns 404 when social not found", async () => {
    vi.mocked(selectSocials).mockResolvedValue([]);
    const res = await postSocialScrapeHandler(request, SOCIAL_ID);
    expect(res.status).toBe(404);
  });

  it("returns 200 with { runId, datasetId } on success", async () => {
    vi.mocked(scrapeProfileUrl).mockResolvedValue({ runId: "r1", datasetId: "d1" } as never);
    const res = await postSocialScrapeHandler(request, SOCIAL_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ runId: "r1", datasetId: "d1" });
  });

  it("returns 400 when platform unsupported (scrapeProfileUrl returns null)", async () => {
    vi.mocked(scrapeProfileUrl).mockResolvedValue(null as never);
    const res = await postSocialScrapeHandler(request, SOCIAL_ID);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      runId: null,
      datasetId: null,
      error: "Unsupported social media platform",
    });
  });

  it("returns 500 when scrape result includes an error", async () => {
    vi.mocked(scrapeProfileUrl).mockResolvedValue({ error: "boom" } as never);
    const res = await postSocialScrapeHandler(request, SOCIAL_ID);
    expect(res.status).toBe(500);
  });

  it("returns 500 when an unexpected error is thrown", async () => {
    vi.mocked(selectSocials).mockRejectedValue(new Error("db down"));
    const res = await postSocialScrapeHandler(request, SOCIAL_ID);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "db down" });
  });
});

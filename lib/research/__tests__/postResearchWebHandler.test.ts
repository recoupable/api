import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { postResearchWebHandler } from "../postResearchWebHandler";
import { validatePostResearchWebRequest } from "../validatePostResearchWebRequest";
import { searchPerplexity } from "@/lib/perplexity/searchPerplexity";
import { formatSearchResultsAsMarkdown } from "@/lib/perplexity/formatSearchResultsAsMarkdown";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validatePostResearchWebRequest", () => ({
  validatePostResearchWebRequest: vi.fn(),
}));

vi.mock("@/lib/perplexity/searchPerplexity", () => ({
  searchPerplexity: vi.fn(),
}));

vi.mock("@/lib/perplexity/formatSearchResultsAsMarkdown", () => ({
  formatSearchResultsAsMarkdown: vi.fn(),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

describe("postResearchWebHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validator error response (e.g. 401)", async () => {
    const err = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validatePostResearchWebRequest).mockResolvedValue(err);

    const req = new NextRequest("http://localhost/api/research/web", {
      method: "POST",
      body: JSON.stringify({ query: "test" }),
    });
    const res = await postResearchWebHandler(req);
    expect(res).toBe(err);
  });

  it("returns validator 400 when body is invalid", async () => {
    const err = NextResponse.json({ error: "bad" }, { status: 400 });
    vi.mocked(validatePostResearchWebRequest).mockResolvedValue(err);

    const req = new NextRequest("http://localhost/api/research/web", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await postResearchWebHandler(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with results and formatted markdown on success", async () => {
    vi.mocked(validatePostResearchWebRequest).mockResolvedValue({
      accountId: "test-id",
      query: "latest music trends",
    });

    const mockResults = [{ title: "Test", url: "https://example.com", snippet: "..." }];
    vi.mocked(searchPerplexity).mockResolvedValue({ results: mockResults } as never);
    vi.mocked(formatSearchResultsAsMarkdown).mockReturnValue("# Results\n...");

    const req = new NextRequest("http://localhost/api/research/web", {
      method: "POST",
      body: JSON.stringify({ query: "latest music trends" }),
    });
    const res = await postResearchWebHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.results).toEqual(mockResults);
    expect(body.formatted).toBe("# Results\n...");
  });
});

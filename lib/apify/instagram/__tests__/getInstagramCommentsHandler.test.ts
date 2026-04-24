import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getInstagramCommentsHandler } from "../getInstagramCommentsHandler";
import { startInstagramCommentsScraping } from "../startInstagramCommentsScraping";
import { validateGetInstagramCommentsRequest } from "../validateGetInstagramCommentsRequest";

vi.mock("../startInstagramCommentsScraping", () => ({
  startInstagramCommentsScraping: vi.fn(),
}));
vi.mock("../validateGetInstagramCommentsRequest", () => ({
  validateGetInstagramCommentsRequest: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const request = new NextRequest(
  "http://localhost/api/instagram/comments?postUrls=https://instagram.com/p/abc",
);

describe("getInstagramCommentsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateGetInstagramCommentsRequest).mockResolvedValue({
      postUrls: ["https://instagram.com/p/abc"],
      resultsLimit: 10000,
    });
  });

  it("propagates validator error (400/401)", async () => {
    const err = NextResponse.json({}, { status: 400 });
    vi.mocked(validateGetInstagramCommentsRequest).mockResolvedValue(err);
    expect(await getInstagramCommentsHandler(request)).toBe(err);
  });

  it("returns 200 with runId and datasetId on success", async () => {
    vi.mocked(startInstagramCommentsScraping).mockResolvedValue({
      runId: "run_1",
      datasetId: "dataset_1",
    });
    const res = await getInstagramCommentsHandler(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ runId: "run_1", datasetId: "dataset_1" });
  });

  it("returns 500 when scraping helper returns null", async () => {
    vi.mocked(startInstagramCommentsScraping).mockResolvedValue(null);
    const res = await getInstagramCommentsHandler(request);
    expect(res.status).toBe(500);
  });

  it("returns generic 500 on thrown error without leaking message", async () => {
    vi.mocked(startInstagramCommentsScraping).mockRejectedValue(
      new Error("apify at 10.0.0.1 down"),
    );
    const res = await getInstagramCommentsHandler(request);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ status: "error", error: "Internal server error" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });
});

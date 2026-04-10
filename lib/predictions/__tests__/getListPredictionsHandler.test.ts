import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getListPredictionsHandler } from "../getListPredictionsHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/predictions/selectPredictions", () => ({
  selectPredictions: vi.fn(),
}));

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectPredictions } from "@/lib/supabase/predictions/selectPredictions";

describe("getListPredictionsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with predictions array", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-uuid",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(selectPredictions).mockResolvedValue([
      {
        id: "pred-1",
        file_url: "https://example.com/v1.mp4",
        modality: "video",
        engagement_score: 73.2,
        created_at: "2026-04-10T00:00:00Z",
      },
    ]);

    const request = new NextRequest("http://localhost/api/predictions");
    const response = await getListPredictionsHandler(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.predictions).toHaveLength(1);
    expect(body.predictions[0].engagement_score).toBe(73.2);
  });

  it("passes limit and offset to selectPredictions", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-uuid",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(selectPredictions).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/predictions?limit=5&offset=10");
    await getListPredictionsHandler(request);

    expect(selectPredictions).toHaveBeenCalledWith("account-uuid", 5, 10);
  });

  it("clamps limit to 100", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-uuid",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(selectPredictions).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/predictions?limit=500");
    await getListPredictionsHandler(request);

    expect(selectPredictions).toHaveBeenCalledWith("account-uuid", 100, 0);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/predictions");
    const response = await getListPredictionsHandler(request);
    expect(response.status).toBe(401);
  });
});

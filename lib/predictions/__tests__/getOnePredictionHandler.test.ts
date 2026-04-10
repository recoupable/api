import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getOnePredictionHandler } from "../getOnePredictionHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/predictions/selectPredictionById", () => ({
  selectPredictionById: vi.fn(),
}));

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectPredictionById } from "@/lib/supabase/predictions/selectPredictionById";

const MOCK_PREDICTION = {
  id: "pred-uuid",
  account_id: "account-uuid",
  file_url: "https://example.com/video.mp4",
  modality: "video",
  engagement_score: 73.2,
  engagement_timeline: [{ time_seconds: 0, score: 45.1 }],
  peak_moments: [{ time_seconds: 12.0, score: 95.4 }],
  weak_spots: [{ time_seconds: 6.0, score: 22.1 }],
  regional_activation: { visual_cortex: 0.72 },
  total_duration_seconds: 60.0,
  elapsed_seconds: 14.2,
  created_at: "2026-04-10T00:00:00Z",
};

describe("getOnePredictionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with prediction when found and owned", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-uuid",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(selectPredictionById).mockResolvedValue(MOCK_PREDICTION);

    const request = new NextRequest("http://localhost/api/predictions/pred-uuid");
    const response = await getOnePredictionHandler(request, "pred-uuid");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.id).toBe("pred-uuid");
    expect(body.engagement_score).toBe(73.2);
  });

  it("returns 404 when prediction not found", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-uuid",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(selectPredictionById).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/predictions/nonexistent");
    const response = await getOnePredictionHandler(request, "nonexistent");
    expect(response.status).toBe(404);
  });

  it("returns 404 when prediction belongs to different account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "other-account",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(selectPredictionById).mockResolvedValue(MOCK_PREDICTION);

    const request = new NextRequest("http://localhost/api/predictions/pred-uuid");
    const response = await getOnePredictionHandler(request, "pred-uuid");
    expect(response.status).toBe(404);
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/predictions/pred-uuid");
    const response = await getOnePredictionHandler(request, "pred-uuid");
    expect(response.status).toBe(401);
  });
});

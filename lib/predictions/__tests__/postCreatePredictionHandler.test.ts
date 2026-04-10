import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { postCreatePredictionHandler } from "../postCreatePredictionHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/tribe/validateCreatePredictionBody", () => ({
  validateCreatePredictionBody: vi.fn(),
}));

vi.mock("@/lib/tribe/processPredictRequest", () => ({
  processPredictRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/predictions/insertPrediction", () => ({
  insertPrediction: vi.fn(),
}));

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateCreatePredictionBody } from "@/lib/tribe/validateCreatePredictionBody";
import { processPredictRequest } from "@/lib/tribe/processPredictRequest";
import { insertPrediction } from "@/lib/supabase/predictions/insertPrediction";

const MOCK_METRICS = {
  type: "success" as const,
  engagement_score: 73.2,
  engagement_timeline: [{ time_seconds: 0, score: 45.1 }],
  peak_moments: [{ time_seconds: 12.0, score: 95.4 }],
  weak_spots: [{ time_seconds: 6.0, score: 22.1 }],
  regional_activation: { visual_cortex: 0.72 },
  total_duration_seconds: 60.0,
  elapsed_seconds: 14.2,
};

const MOCK_ROW = {
  id: "test-uuid",
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

describe("postCreatePredictionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with prediction on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-uuid",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(validateCreatePredictionBody).mockReturnValue({
      file_url: "https://example.com/video.mp4",
      modality: "video",
    });
    vi.mocked(processPredictRequest).mockResolvedValue(MOCK_METRICS);
    vi.mocked(insertPrediction).mockResolvedValue(MOCK_ROW);

    const request = new NextRequest("http://localhost/api/predictions", {
      method: "POST",
      body: JSON.stringify({
        file_url: "https://example.com/video.mp4",
        modality: "video",
      }),
    });

    const response = await postCreatePredictionHandler(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.id).toBe("test-uuid");
    expect(body.engagement_score).toBe(73.2);
  });

  it("returns 400 on invalid JSON body", async () => {
    const request = new NextRequest("http://localhost/api/predictions", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });

    const response = await postCreatePredictionHandler(request);
    expect(response.status).toBe(400);
  });

  it("returns auth error when validateAuthContext fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/predictions", {
      method: "POST",
      body: JSON.stringify({ file_url: "https://example.com/v.mp4", modality: "video" }),
    });

    const response = await postCreatePredictionHandler(request);
    expect(response.status).toBe(401);
  });

  it("returns 500 when prediction fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-uuid",
      orgId: null,
      authToken: "test-token",
    });
    vi.mocked(validateCreatePredictionBody).mockReturnValue({
      file_url: "https://example.com/video.mp4",
      modality: "video",
    });
    vi.mocked(processPredictRequest).mockResolvedValue({
      type: "error",
      error: "Model unavailable",
    });

    const request = new NextRequest("http://localhost/api/predictions", {
      method: "POST",
      body: JSON.stringify({ file_url: "https://example.com/v.mp4", modality: "video" }),
    });

    const response = await postCreatePredictionHandler(request);
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe("Model unavailable");
  });
});

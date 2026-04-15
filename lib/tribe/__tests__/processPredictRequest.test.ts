import { describe, it, expect, vi, beforeEach } from "vitest";
import { processPredictRequest } from "../processPredictRequest";

vi.mock("../callTribePredict", () => ({
  callTribePredict: vi.fn(),
}));

import { callTribePredict } from "../callTribePredict";

const MOCK_RESULT = {
  engagement_score: 73.2,
  engagement_timeline: [{ time_seconds: 0, score: 45.1 }],
  peak_moments: [{ time_seconds: 12.0, score: 95.4 }],
  weak_spots: [{ time_seconds: 6.0, score: 22.1 }],
  regional_activation: { visual_cortex: 0.72 },
  total_duration_seconds: 60.0,
  elapsed_seconds: 14.2,
};

describe("processPredictRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success with metrics on successful prediction", async () => {
    vi.mocked(callTribePredict).mockResolvedValue(MOCK_RESULT);

    const result = await processPredictRequest({
      file_url: "https://example.com/video.mp4",
      modality: "video",
    });

    expect(result.type).toBe("success");
    if (result.type === "success") {
      expect(result.engagement_score).toBe(73.2);
    }
  });

  it("returns error when callTribePredict throws", async () => {
    vi.mocked(callTribePredict).mockRejectedValue(new Error("Connection refused"));

    const result = await processPredictRequest({
      file_url: "https://example.com/video.mp4",
      modality: "video",
    });

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.error).toBe("Connection refused");
    }
  });
});

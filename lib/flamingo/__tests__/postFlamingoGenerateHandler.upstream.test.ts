import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { postFlamingoGenerateHandler } from "../postFlamingoGenerateHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { executeFullReport } from "@/lib/flamingo/executeFullReport";
import { FlamingoServiceError } from "@/lib/flamingo/FlamingoServiceError";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({
  verifyAudioUrl: vi.fn().mockResolvedValue({ ok: true, contentType: "audio/mpeg" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({ callFlamingoGenerate: vi.fn() }));
vi.mock("@/lib/flamingo/executeFullReport", () => ({ executeFullReport: vi.fn() }));
vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/flamingo/chargeForFlamingoCall", () => ({
  chargeForFlamingoCall: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Creates a mock NextRequest with a JSON body.
 *
 * @param body - The JSON body to include in the request.
 * @returns A mock NextRequest object.
 */
function createMockRequest(body: Record<string, unknown>): NextRequest {
  return {
    headers: new Headers({ "x-api-key": "test-key" }),
    json: async () => body,
  } as unknown as NextRequest;
}

describe("postFlamingoGenerateHandler — upstream failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "test-key",
    });
  });

  it("returns 502 with the upstream status when the model service rejects a call", async () => {
    vi.mocked(callFlamingoGenerate).mockRejectedValue(
      new FlamingoServiceError(422, "audio_undecodable: ffmpeg could not read the file"),
    );

    const result = await postFlamingoGenerateHandler(
      createMockRequest({ prompt: "Describe this track.", audio_url: "https://x.test/a.m4a" }),
    );
    const body = await result.json();

    expect(result.status).toBe(502);
    expect(body).toEqual({
      status: "error",
      error: "Music analysis failed (status 422)",
      upstream_status: 422,
      detail: "audio_undecodable: ffmpeg could not read the file",
    });
  });

  it("returns 502 when every full_report section failed", async () => {
    vi.mocked(executeFullReport).mockResolvedValue({
      report: { overview: { error: "Section failed: x" } },
      elapsed_seconds: 2,
      failed: ["overview"],
    });

    const result = await postFlamingoGenerateHandler(
      createMockRequest({ preset: "full_report", audio_url: "https://x.test/a.m4a" }),
    );
    const body = await result.json();

    expect(result.status).toBe(502);
    expect(body).toEqual({
      status: "error",
      error: "Music analysis failed for every section",
      failed: ["overview"],
    });
  });

  it("returns 200 with status partial and the failed keys when some sections failed", async () => {
    vi.mocked(executeFullReport).mockResolvedValue({
      report: { overview: { genre: "pop" }, sync: { error: "Section failed: x" } },
      elapsed_seconds: 20,
      failed: ["sync"],
    });

    const result = await postFlamingoGenerateHandler(
      createMockRequest({ preset: "full_report", audio_url: "https://x.test/a.mp3" }),
    );
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body).toEqual({
      status: "partial",
      preset: "full_report",
      report: { overview: { genre: "pop" }, sync: { error: "Section failed: x" } },
      elapsed_seconds: 20,
      failed: ["sync"],
    });
  });
});

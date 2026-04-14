import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getFlamingoPresetsHandler } from "../getFlamingoPresetsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getPresetSummaries } from "../presets";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("../presets", () => ({
  getPresetSummaries: vi.fn(),
}));

/**
 * Create Mock Request.
 *
 * @returns - Result.
 */
function createMockRequest(): NextRequest {
  return {
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("getFlamingoPresetsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when authentication fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const result = await getFlamingoPresetsHandler(createMockRequest());
    expect(result.status).toBe(401);
  });

  it("returns preset summaries when authentication succeeds", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "test-key",
    });
    vi.mocked(getPresetSummaries).mockReturnValue([
      {
        name: "catalog_metadata",
        label: "Catalog Metadata",
        description: "Extracts metadata from a track",
        requiresAudio: true,
        responseFormat: "json",
      },
    ]);

    const result = await getFlamingoPresetsHandler(createMockRequest());
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      presets: [
        {
          name: "catalog_metadata",
          label: "Catalog Metadata",
          description: "Extracts metadata from a track",
          requiresAudio: true,
          responseFormat: "json",
        },
      ],
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { postFlamingoGenerateHandler } from "../postFlamingoGenerateHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({
  callFlamingoGenerate: vi.fn(),
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

describe("postFlamingoGenerateHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful cases", () => {
    it("returns model response with status success", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "test-key",
      });
      vi.mocked(callFlamingoGenerate).mockResolvedValue({
        response: "This is a jazz piece in Bb major.",
        elapsed_seconds: 2.5,
      });

      const request = createMockRequest({
        prompt: "Describe this track.",
      });
      const result = await postFlamingoGenerateHandler(request);
      const body = await result.json();

      expect(result.status).toBe(200);
      expect(body).toEqual({
        status: "success",
        response: "This is a jazz piece in Bb major.",
        elapsed_seconds: 2.5,
      });
    });

    it("passes validated body to callFlamingoGenerate", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "test-key",
      });
      vi.mocked(callFlamingoGenerate).mockResolvedValue({
        response: "test",
        elapsed_seconds: 1.0,
      });

      const request = createMockRequest({
        prompt: "What genre?",
        audio_url: "https://example.com/song.mp3",
        max_new_tokens: 256,
      });
      await postFlamingoGenerateHandler(request);

      expect(callFlamingoGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "What genre?",
          audio_url: "https://example.com/song.mp3",
          max_new_tokens: 256,
        }),
      );
    });
  });

  describe("error cases", () => {
    it("returns 401 when authentication fails", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest({ prompt: "test" });
      const result = await postFlamingoGenerateHandler(request);

      expect(result.status).toBe(401);
    });

    it("returns 400 when validation fails (missing prompt)", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "test-key",
      });

      const request = createMockRequest({});
      const result = await postFlamingoGenerateHandler(request);

      expect(result.status).toBe(400);
    });

    it("returns 500 when Modal call fails", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "test-key",
      });
      vi.mocked(callFlamingoGenerate).mockRejectedValue(
        new Error("Flamingo model returned 503: Service Unavailable"),
      );

      const request = createMockRequest({
        prompt: "Describe this track.",
      });
      const result = await postFlamingoGenerateHandler(request);
      const body = await result.json();

      expect(result.status).toBe(500);
      expect(body).toEqual({
        status: "error",
        error: "Flamingo model returned 503: Service Unavailable",
      });
    });
  });
});

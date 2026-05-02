import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

import {
  validateRenderVideoBody,
  type RenderVideoBody,
} from "@/lib/render/validateRenderVideoBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("validateRenderVideoBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful validation", () => {
    it("accepts a valid body with only compositionId", () => {
      const result = validateRenderVideoBody({
        compositionId: "SocialPost",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      const validated = result as RenderVideoBody;
      expect(validated.compositionId).toBe("SocialPost");
      // Defaults should be applied
      expect(validated.inputProps).toEqual({});
      expect(validated.width).toBe(720);
      expect(validated.height).toBe(1280);
      expect(validated.fps).toBe(30);
      expect(validated.durationInFrames).toBe(240);
      expect(validated.codec).toBe("h264");
    });

    it("accepts a valid body with all fields", () => {
      const result = validateRenderVideoBody({
        compositionId: "CommitShowcase",
        inputProps: { videoUrl: "https://example.com/video.mp4" },
        width: 1080,
        height: 1920,
        fps: 60,
        durationInFrames: 900,
        codec: "vp9",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      const validated = result as RenderVideoBody;
      expect(validated.compositionId).toBe("CommitShowcase");
      expect(validated.inputProps).toEqual({
        videoUrl: "https://example.com/video.mp4",
      });
      expect(validated.width).toBe(1080);
      expect(validated.height).toBe(1920);
      expect(validated.fps).toBe(60);
      expect(validated.durationInFrames).toBe(900);
      expect(validated.codec).toBe("vp9");
    });

    it("accepts all supported codecs", () => {
      const codecs = ["h264", "h265", "vp8", "vp9"] as const;

      for (const codec of codecs) {
        const result = validateRenderVideoBody({
          compositionId: "SocialPost",
          codec,
        });
        expect(result).not.toBeInstanceOf(NextResponse);
        expect((result as RenderVideoBody).codec).toBe(codec);
      }
    });
  });

  describe("error cases", () => {
    it("returns 400 when compositionId is missing", () => {
      const result = validateRenderVideoBody({});

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when compositionId is empty string", () => {
      const result = validateRenderVideoBody({ compositionId: "" });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when width exceeds maximum", () => {
      const result = validateRenderVideoBody({
        compositionId: "SocialPost",
        width: 5000,
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when height is zero", () => {
      const result = validateRenderVideoBody({
        compositionId: "SocialPost",
        height: 0,
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when fps exceeds maximum", () => {
      const result = validateRenderVideoBody({
        compositionId: "SocialPost",
        fps: 120,
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when durationInFrames exceeds maximum", () => {
      const result = validateRenderVideoBody({
        compositionId: "SocialPost",
        durationInFrames: 5000,
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when codec is invalid", () => {
      const result = validateRenderVideoBody({
        compositionId: "SocialPost",
        codec: "mp4",
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("includes error message in response body", async () => {
      const result = validateRenderVideoBody({}) as NextResponse;
      const body = await result.json();

      expect(body.status).toBe("error");
      expect(body.error).toBeDefined();
    });
  });
});

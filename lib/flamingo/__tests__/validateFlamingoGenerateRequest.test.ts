import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFlamingoGenerateRequest } from "../validateFlamingoGenerateRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/flamingo/verifyAudioUrl", () => ({ verifyAudioUrl: vi.fn() }));

const AUDIO = "https://example.com/song.mp3";

function request(body: unknown): NextRequest {
  return {
    headers: new Headers({ "x-api-key": "k" }),
    json: async () => body,
  } as unknown as NextRequest;
}

async function bodyOf(result: unknown): Promise<unknown> {
  return (result as NextResponse).json();
}

describe("validateFlamingoGenerateRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
      orgId: null,
      authToken: "k",
    });
    vi.mocked(verifyAudioUrl).mockResolvedValue({ ok: true, contentType: "audio/mpeg" });
  });

  describe("accepted bodies", () => {
    it("returns the account and the body with defaults for a prompt", async () => {
      const result = await validateFlamingoGenerateRequest(
        request({ prompt: "What genre is this track?", audio_url: AUDIO }),
      );

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({
        accountId: "acc_1",
        body: {
          prompt: "What genre is this track?",
          audio_url: AUDIO,
          max_new_tokens: 512,
          temperature: 1.0,
          top_p: 1.0,
          do_sample: false,
        },
      });
    });

    it("keeps explicit generation params", async () => {
      const result = await validateFlamingoGenerateRequest(
        request({
          prompt: "Describe the mood.",
          audio_url: AUDIO,
          max_new_tokens: 256,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
        }),
      );

      expect(result).toMatchObject({
        body: { max_new_tokens: 256, temperature: 0.7, top_p: 0.9, do_sample: true },
      });
    });

    it("accepts every preset, full_report included, and verifies the audio once", async () => {
      const result = await validateFlamingoGenerateRequest(
        request({ preset: "full_report", audio_url: AUDIO }),
      );

      expect(result).toMatchObject({ body: { preset: "full_report" } });
      expect(verifyAudioUrl).toHaveBeenCalledTimes(1);
      expect(verifyAudioUrl).toHaveBeenCalledWith(AUDIO);
    });
  });

  describe("order: JSON parse, auth, body rules, audio", () => {
    it("returns 400 for malformed JSON before auth", async () => {
      const result = await validateFlamingoGenerateRequest({
        headers: new Headers(),
        json: async () => {
          throw new SyntaxError("bad json");
        },
      } as unknown as NextRequest);

      expect((result as NextResponse).status).toBe(400);
      expect(await bodyOf(result)).toEqual({
        status: "error",
        error: "Request body must be valid JSON",
      });
      expect(validateAuthContext).not.toHaveBeenCalled();
    });

    it("returns the auth failure before validating the body", async () => {
      const denied = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      vi.mocked(validateAuthContext).mockResolvedValue(denied);

      const result = await validateFlamingoGenerateRequest(request({}));

      expect(result).toBe(denied);
      expect(verifyAudioUrl).not.toHaveBeenCalled();
    });

    it("returns 400 with missing_fields before verifying anything", async () => {
      const result = await validateFlamingoGenerateRequest(request({ prompt: "Genre?" }));

      expect((result as NextResponse).status).toBe(400);
      expect(await bodyOf(result)).toEqual({
        status: "error",
        missing_fields: ["audio_url"],
        error: "audio_url is required",
      });
      expect(verifyAudioUrl).not.toHaveBeenCalled();
    });

    it("returns the documented 422 with CORS when the audio does not verify", async () => {
      vi.mocked(verifyAudioUrl).mockResolvedValue({
        ok: false,
        error: "audio_url_not_audio",
        message: "audio_url answered 200 with content type text/html",
      });

      const result = await validateFlamingoGenerateRequest(
        request({ preset: "mood_tags", audio_url: AUDIO }),
      );

      expect((result as NextResponse).status).toBe(422);
      expect((result as NextResponse).headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(await bodyOf(result)).toEqual({
        status: "error",
        error: "audio_url_not_audio",
        message: "audio_url answered 200 with content type text/html",
      });
    });
  });

  describe("body rules", () => {
    it.each([
      ["neither preset nor prompt", { audio_url: AUDIO }, ["preset"]],
      [
        "both preset and prompt",
        { preset: "mood_tags", prompt: "x", audio_url: AUDIO },
        ["prompt"],
      ],
      ["unknown preset", { preset: "nope", audio_url: AUDIO }, ["preset"]],
      ["empty prompt", { prompt: "", audio_url: AUDIO }, ["prompt"]],
      ["audio_url not a URL", { prompt: "Genre?", audio_url: "not-a-url" }, ["audio_url"]],
      [
        "max_new_tokens over 2048",
        { prompt: "x", audio_url: AUDIO, max_new_tokens: 5000 },
        ["max_new_tokens"],
      ],
      ["empty body", {}, ["audio_url"]],
      ["null body", null, []],
    ])("returns 400 for %s", async (_name, body, path) => {
      const result = await validateFlamingoGenerateRequest(request(body));

      expect((result as NextResponse).status).toBe(400);
      expect(await bodyOf(result)).toMatchObject({ status: "error", missing_fields: path });
      expect(verifyAudioUrl).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateFlamingoGenerateBatchRequest } from "../validateFlamingoGenerateBatchRequest";
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

describe("validateFlamingoGenerateBatchRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
      orgId: null,
      authToken: "k",
    });
    vi.mocked(verifyAudioUrl).mockResolvedValue({ ok: true, contentType: "audio/mpeg" });
  });

  it("returns the account and the body with defaults, verifying the audio once", async () => {
    const result = await validateFlamingoGenerateBatchRequest(
      request({
        audio_url: AUDIO,
        prompts: [
          { id: "genre", prompt: "What genre?" },
          { id: "tempo", prompt: "What tempo?", max_new_tokens: 32 },
        ],
      }),
    );

    expect(result).toEqual({
      accountId: "acc_1",
      body: {
        audio_url: AUDIO,
        prompts: [
          { id: "genre", prompt: "What genre?", max_new_tokens: 400 },
          { id: "tempo", prompt: "What tempo?", max_new_tokens: 32 },
        ],
        temperature: 0.2,
        top_p: 1,
        do_sample: false,
      },
    });
    expect(verifyAudioUrl).toHaveBeenCalledTimes(1);
    expect(verifyAudioUrl).toHaveBeenCalledWith(AUDIO);
  });

  it("returns 400 for malformed JSON before auth", async () => {
    const result = await validateFlamingoGenerateBatchRequest({
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

  it("returns the 401 from auth before validating the body", async () => {
    const denied = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(denied);

    const result = await validateFlamingoGenerateBatchRequest(request({}));

    expect(result).toBe(denied);
    expect((result as NextResponse).status).toBe(401);
    expect(verifyAudioUrl).not.toHaveBeenCalled();
  });

  it("returns 400 with missing_fields before verifying the audio", async () => {
    const result = await validateFlamingoGenerateBatchRequest(request({ audio_url: AUDIO }));

    expect((result as NextResponse).status).toBe(400);
    expect(await bodyOf(result)).toEqual({
      status: "error",
      missing_fields: ["prompts"],
      error: "prompts is required",
    });
    expect(verifyAudioUrl).not.toHaveBeenCalled();
  });

  it("returns 400 for repeated prompt ids", async () => {
    const result = await validateFlamingoGenerateBatchRequest(
      request({
        audio_url: AUDIO,
        prompts: [
          { id: "a", prompt: "x" },
          { id: "a", prompt: "y" },
        ],
      }),
    );

    expect((result as NextResponse).status).toBe(400);
    expect(await bodyOf(result)).toEqual({
      status: "error",
      missing_fields: ["prompts"],
      error: "prompt ids must be unique",
    });
  });

  it("returns the documented 422 with CORS when the audio does not verify", async () => {
    vi.mocked(verifyAudioUrl).mockResolvedValue({
      ok: false,
      error: "audio_url_unreachable",
      message: "audio_url answered HTTP 404",
    });

    const result = await validateFlamingoGenerateBatchRequest(
      request({ audio_url: AUDIO, prompts: [{ id: "a", prompt: "x" }] }),
    );

    expect((result as NextResponse).status).toBe(422);
    expect((result as NextResponse).headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await bodyOf(result)).toEqual({
      status: "error",
      error: "audio_url_unreachable",
      message: "audio_url answered HTTP 404",
    });
  });
});

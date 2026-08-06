import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateTranscribeRequest } from "../validateTranscribeRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

const CALLER_ID = "11111111-1111-4111-8111-111111111111";
const ARTIST_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ACCOUNT_ID = "33333333-3333-4333-8333-333333333333";
const AUDIO_URL = "https://example.com/audio.mp3";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/transcribe", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("validateTranscribeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: CALLER_ID,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(canAccessAccount).mockResolvedValue(true);
  });

  describe("valid requests", () => {
    it("derives ownerAccountId from the authenticated caller", async () => {
      const result = await validateTranscribeRequest(
        buildRequest({ audio_url: AUDIO_URL, artist_account_id: ARTIST_ID }),
      );

      expect(result).toEqual({
        audioUrl: AUDIO_URL,
        ownerAccountId: CALLER_ID,
        artistAccountId: ARTIST_ID,
        title: undefined,
        includeTimestamps: undefined,
      });
    });

    it("passes through optional title and include_timestamps", async () => {
      const result = await validateTranscribeRequest(
        buildRequest({
          audio_url: AUDIO_URL,
          artist_account_id: ARTIST_ID,
          title: "Interview",
          include_timestamps: true,
        }),
      );

      expect(result).toMatchObject({ title: "Interview", includeTimestamps: true });
    });
  });

  describe("account_id can no longer be supplied by the caller", () => {
    it("ignores a body-supplied account_id and uses the authenticated account instead", async () => {
      const result = await validateTranscribeRequest(
        buildRequest({
          audio_url: AUDIO_URL,
          artist_account_id: ARTIST_ID,
          account_id: OTHER_ACCOUNT_ID,
        }),
      );

      expect(result).toMatchObject({ ownerAccountId: CALLER_ID });
      expect(result).not.toMatchObject({ ownerAccountId: OTHER_ACCOUNT_ID });
    });
  });

  describe("authentication", () => {
    it("returns 401 when the caller is unauthenticated", async () => {
      const unauthorized = NextResponse.json({ status: "error" }, { status: 401 });
      vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

      const result = await validateTranscribeRequest(
        buildRequest({ audio_url: AUDIO_URL, artist_account_id: ARTIST_ID }),
      );

      expect(result).toBe(unauthorized);
    });

    it("authenticates before validating the body, so no work is attributable to an anonymous caller", async () => {
      const unauthorized = NextResponse.json({ status: "error" }, { status: 401 });
      vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

      const result = await validateTranscribeRequest(buildRequest({}));

      expect(result).toBe(unauthorized);
      expect(canAccessAccount).not.toHaveBeenCalled();
    });
  });

  describe("authorization", () => {
    it("returns 403 when the caller cannot access the artist account", async () => {
      vi.mocked(canAccessAccount).mockResolvedValue(false);

      const result = await validateTranscribeRequest(
        buildRequest({ audio_url: AUDIO_URL, artist_account_id: ARTIST_ID }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(403);
      expect(canAccessAccount).toHaveBeenCalledWith({
        currentAccountId: CALLER_ID,
        targetAccountId: ARTIST_ID,
      });
    });
  });

  describe("body validation", () => {
    it("returns 400 when audio_url is missing", async () => {
      const result = await validateTranscribeRequest(
        buildRequest({ artist_account_id: ARTIST_ID }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when audio_url is not a URL", async () => {
      const result = await validateTranscribeRequest(
        buildRequest({ audio_url: "not-a-url", artist_account_id: ARTIST_ID }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when artist_account_id is missing", async () => {
      const result = await validateTranscribeRequest(buildRequest({ audio_url: AUDIO_URL }));

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when artist_account_id is not a UUID", async () => {
      const result = await validateTranscribeRequest(
        buildRequest({ audio_url: AUDIO_URL, artist_account_id: "not-a-uuid" }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when the body is not valid JSON", async () => {
      const result = await validateTranscribeRequest(buildRequest("{oops"));

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });
});

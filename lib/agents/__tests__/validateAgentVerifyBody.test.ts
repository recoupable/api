import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAgentVerifyBody } from "@/lib/agents/validateAgentVerifyBody";
import { getPrivyUserByEmail } from "@/lib/privy/getPrivyUserByEmail";
import { setPrivyCustomMetadata } from "@/lib/privy/setPrivyCustomMetadata";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Builds a NextRequest with the given JSON body for the verify endpoint.
 *
 * @param body - JSON-serializable body, or undefined for an empty request
 * @returns A NextRequest pointed at /api/agents/verify
 */
function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/agents/verify", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

vi.mock("@/lib/privy/getPrivyUserByEmail", () => ({
  getPrivyUserByEmail: vi.fn(),
}));

vi.mock("@/lib/privy/setPrivyCustomMetadata", () => ({
  setPrivyCustomMetadata: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountByEmail", () => ({
  selectAccountByEmail: vi.fn(),
}));

vi.mock("@/lib/keys/hashApiKey", () => ({
  hashApiKey: vi.fn((input: string) => `hashed_${input}`),
}));

const VALID_REQUEST = () => buildRequest({ email: "user@example.com", code: "123456" });

/**
 * Builds a Privy `custom_metadata` payload with sensible defaults that
 * pass every prerequisite check, letting individual tests override only
 * the field they want to exercise.
 *
 * @param overrides - Fields to overlay on top of the valid defaults
 * @returns A fully populated metadata object
 */
function metadataWith(overrides: Record<string, unknown> = {}): {
  verification_code_hash: string;
  verification_expires_at: string;
  verification_attempts: number;
} {
  return {
    verification_code_hash: "hashed_123456",
    verification_expires_at: new Date(Date.now() + 60_000).toISOString(),
    verification_attempts: 0,
    ...overrides,
  } as {
    verification_code_hash: string;
    verification_expires_at: string;
    verification_attempts: number;
  };
}

describe("validateAgentVerifyBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROJECT_SECRET = "test-secret";
  });

  describe("body shape", () => {
    it("returns 400 for missing email", async () => {
      const result = await validateAgentVerifyBody(buildRequest({ code: "123456" }));
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 for missing code", async () => {
      const result = await validateAgentVerifyBody(buildRequest({ email: "user@example.com" }));
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 for invalid email", async () => {
      const result = await validateAgentVerifyBody(buildRequest({ email: "bad", code: "123456" }));
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 for non-numeric code", async () => {
      const result = await validateAgentVerifyBody(
        buildRequest({ email: "user@example.com", code: "abcdef" }),
      );
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 for 5-digit code", async () => {
      const result = await validateAgentVerifyBody(
        buildRequest({ email: "user@example.com", code: "12345" }),
      );
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 for 7-digit code", async () => {
      const result = await validateAgentVerifyBody(
        buildRequest({ email: "user@example.com", code: "1234567" }),
      );
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });

  describe("stored verification state", () => {
    it("returns 400 when Privy user is missing", async () => {
      vi.mocked(getPrivyUserByEmail).mockResolvedValue(null);
      const result = await validateAgentVerifyBody(VALID_REQUEST());
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when no verification_code_hash is stored", async () => {
      vi.mocked(getPrivyUserByEmail).mockResolvedValue({
        id: "privy_1",
        custom_metadata: {},
      });
      const result = await validateAgentVerifyBody(VALID_REQUEST());
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when verification_expires_at is missing (fail-safe)", async () => {
      vi.mocked(getPrivyUserByEmail).mockResolvedValue({
        id: "privy_1",
        custom_metadata: { verification_code_hash: "hashed_123456", verification_attempts: 0 },
      });
      const result = await validateAgentVerifyBody(VALID_REQUEST());
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when the code has expired", async () => {
      vi.mocked(getPrivyUserByEmail).mockResolvedValue({
        id: "privy_1",
        custom_metadata: metadataWith({
          verification_expires_at: new Date(Date.now() - 1_000).toISOString(),
        }),
      });
      const result = await validateAgentVerifyBody(VALID_REQUEST());
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when verification_expires_at is a malformed string (NaN guard)", async () => {
      // Set the success path up so the ONLY way to fail is the expiry check.
      // Without the NaN guard, the malformed string parses to NaN, the
      // `Date.now() > NaN` comparison is `false`, the expiry check is silently
      // skipped, the (mocked-matching) hash comparison passes, and the function
      // would succeed instead of rejecting — that's the silent bypass we're
      // guarding against.
      vi.mocked(getPrivyUserByEmail).mockResolvedValue({
        id: "privy_1",
        custom_metadata: metadataWith({ verification_expires_at: "not-a-real-date" }),
      });
      vi.mocked(selectAccountByEmail).mockResolvedValue({
        account_id: "acc_should_not_be_returned",
        email: "user@example.com",
      } as unknown as Awaited<ReturnType<typeof selectAccountByEmail>>);

      const result = await validateAgentVerifyBody(VALID_REQUEST());

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 429 when verification_attempts is at or above the limit", async () => {
      vi.mocked(getPrivyUserByEmail).mockResolvedValue({
        id: "privy_1",
        custom_metadata: metadataWith({ verification_attempts: 5 }),
      });
      const result = await validateAgentVerifyBody(VALID_REQUEST());
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(429);
    });
  });

  describe("code comparison", () => {
    it("returns 400 and increments attempts when the submitted code does not match", async () => {
      vi.mocked(getPrivyUserByEmail).mockResolvedValue({
        id: "privy_1",
        custom_metadata: metadataWith({ verification_code_hash: "hashed_999999" }),
      });
      const result = await validateAgentVerifyBody(VALID_REQUEST());
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
      expect(setPrivyCustomMetadata).toHaveBeenCalledWith(
        "privy_1",
        expect.objectContaining({ verification_attempts: 1 }),
      );
    });
  });

  describe("account resolution", () => {
    it("returns 400 when the email has no matching account", async () => {
      vi.mocked(getPrivyUserByEmail).mockResolvedValue({
        id: "privy_1",
        custom_metadata: metadataWith(),
      });
      vi.mocked(selectAccountByEmail).mockResolvedValue(null);
      const result = await validateAgentVerifyBody(VALID_REQUEST());
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });

  describe("success", () => {
    it("returns the resolved accountId and privyUserId", async () => {
      vi.mocked(getPrivyUserByEmail).mockResolvedValue({
        id: "privy_1",
        custom_metadata: metadataWith(),
      });
      vi.mocked(selectAccountByEmail).mockResolvedValue({
        account_id: "acc_123",
        email: "user@example.com",
      } as unknown as Awaited<ReturnType<typeof selectAccountByEmail>>);

      const result = await validateAgentVerifyBody(VALID_REQUEST());

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ accountId: "acc_123", privyUserId: "privy_1" });
    });
  });
});

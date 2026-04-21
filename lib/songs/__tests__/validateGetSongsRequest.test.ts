import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetSongsRequest } from "../validateGetSongsRequest";

const mockValidateAuthContext = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, {
    headers: { authorization: "Bearer test-token" },
  });
}

describe("validateGetSongsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({
      accountId: "auth-account",
      orgId: null,
      authToken: "test-token",
    });
  });

  it("returns authentication failure verbatim without parsing query", async () => {
    const unauthorized = NextResponse.json({ error: "unauthorized" }, { status: 401 });
    mockValidateAuthContext.mockResolvedValue(unauthorized);

    const req = new NextRequest("https://example.com/api/songs?artist_account_id=not-a-uuid");
    const result = await validateGetSongsRequest(req);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("does NOT pass path/query id as an accountId override to validateAuthContext", async () => {
    const req = makeRequest(`https://example.com/api/songs?artist_account_id=${VALID_UUID}`);
    await validateGetSongsRequest(req);

    // No args (or only `request`) means no silent-bypass of canAccessAccount.
    expect(mockValidateAuthContext).toHaveBeenCalledTimes(1);
    expect(mockValidateAuthContext.mock.calls[0][1]).toBeUndefined();
  });

  it("returns parsed snake_case params on success with isrc", async () => {
    const req = makeRequest("https://example.com/api/songs?isrc=USRC17607839");
    const result = await validateGetSongsRequest(req);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result).toEqual({ isrc: "USRC17607839" });
    }
  });

  it("returns parsed snake_case params on success with artist_account_id", async () => {
    const req = makeRequest(`https://example.com/api/songs?artist_account_id=${VALID_UUID}`);
    const result = await validateGetSongsRequest(req);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result).toEqual({ artist_account_id: VALID_UUID });
    }
  });

  it("returns empty object when both filters are omitted", async () => {
    const req = makeRequest("https://example.com/api/songs");
    const result = await validateGetSongsRequest(req);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result).toEqual({});
    }
  });

  it.each([
    {
      name: "invalid UUID",
      url: "https://example.com/api/songs?artist_account_id=not-a-uuid",
      missing: "artist_account_id",
    },
    {
      name: "empty isrc after trim",
      url: "https://example.com/api/songs?isrc=%20%20",
      missing: "isrc",
    },
  ])("returns 400 on $name", async ({ url, missing }) => {
    const req = makeRequest(url);
    const result = await validateGetSongsRequest(req);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.status).toBe("error");
    expect(body.missing_fields).toEqual([missing]);
  });
});

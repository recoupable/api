import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";
import { validateGetFilesQuery } from "../validateGetFilesQuery";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

/**
 * Creates a mock NextRequest for GET /api/files validation tests.
 *
 * @param url - Request URL.
 * @returns A mocked NextRequest instance.
 */
function createRequest(url: string): NextRequest {
  return {
    url,
    headers: new Headers({ authorization: "Bearer token" }),
  } as unknown as NextRequest;
}

describe("validateGetFilesQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth errors directly", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateGetFilesQuery(createRequest("http://localhost/api/files"));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 400 when artist_account_id is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      authToken: "token",
      orgId: null,
    });

    const result = await validateGetFilesQuery(createRequest("http://localhost/api/files"));

    expect((result as NextResponse).status).toBe(400);
    await expect((result as NextResponse).json()).resolves.toMatchObject({
      error: "Invalid input: expected string, received undefined",
    });
  });

  it("returns 400 when artist_account_id is invalid", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      authToken: "token",
      orgId: null,
    });

    const result = await validateGetFilesQuery(
      createRequest("http://localhost/api/files?artist_account_id=not-a-uuid"),
    );

    expect((result as NextResponse).status).toBe(400);
    await expect((result as NextResponse).json()).resolves.toMatchObject({
      error: "artist_account_id must be a valid UUID",
    });
  });

  it("returns 403 when requester cannot access the artist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      authToken: "token",
      orgId: null,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);

    const result = await validateGetFilesQuery(
      createRequest(
        "http://localhost/api/files?artist_account_id=550e8400-e29b-41d4-a716-446655440000",
      ),
    );

    expect(checkAccountArtistAccess).toHaveBeenCalledWith(
      "account-123",
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns validated params for direct artist access", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      authToken: "token",
      orgId: null,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const result = await validateGetFilesQuery(
      createRequest(
        "http://localhost/api/files?artist_account_id=550e8400-e29b-41d4-a716-446655440000&path=reports&recursive=true",
      ),
    );

    expect(result).toEqual({
      artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
      path: "reports",
      recursive: true,
      requesterAccountId: "account-123",
    });
  });

  it("parses recursive=false as false", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      authToken: "token",
      orgId: null,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const result = await validateGetFilesQuery(
      createRequest(
        "http://localhost/api/files?artist_account_id=550e8400-e29b-41d4-a716-446655440000&recursive=false",
      ),
    );

    expect(result).toEqual({
      artist_account_id: "550e8400-e29b-41d4-a716-446655440000",
      recursive: false,
      requesterAccountId: "account-123",
    });
  });

  it("returns validated params for shared-org artist access", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-456",
      authToken: "token",
      orgId: null,
    });
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const result = await validateGetFilesQuery(
      createRequest(
        "http://localhost/api/files?artist_account_id=550e8400-e29b-41d4-a716-446655440001",
      ),
    );

    expect(result).toEqual({
      artist_account_id: "550e8400-e29b-41d4-a716-446655440001",
      recursive: false,
      requesterAccountId: "account-456",
    });
  });
});

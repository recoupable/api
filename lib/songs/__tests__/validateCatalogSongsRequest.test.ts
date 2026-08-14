import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCatalogSongsRequest } from "@/lib/songs/validateCatalogSongsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { authorizeCatalogAccess } from "@/lib/songs/authorizeCatalogAccess";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/songs/authorizeCatalogAccess", () => ({ authorizeCatalogAccess: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const post = (body: unknown) =>
  new NextRequest("https://api.test/api/catalogs/songs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("validateCatalogSongsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorizeCatalogAccess).mockResolvedValue(null);
  });

  /**
   * chat#1912 row 6. The order is the contract: 401 before 400 before 403.
   * A malformed body from an unauthenticated caller previously returned 400,
   * and that 400-without-credentials is exactly what proved the endpoint had
   * no auth layer. Body validation must never run first.
   */
  it("returns 401 for a malformed body when the caller has no credentials", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );

    const result = await validateCatalogSongsRequest(post({}));

    expect((result as NextResponse).status).toBe(401);
    expect(authorizeCatalogAccess).not.toHaveBeenCalled();
  });

  it("returns 400 for a malformed body once the caller is authenticated", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);

    const result = await validateCatalogSongsRequest(post({}));

    expect((result as NextResponse).status).toBe(400);
    // Ownership is meaningless without a valid body, so it must not be consulted.
    expect(authorizeCatalogAccess).not.toHaveBeenCalled();
  });

  it("returns the authorization failure for someone else's catalog", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
    vi.mocked(authorizeCatalogAccess).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 403 }) as never,
    );

    const result = await validateCatalogSongsRequest(
      post({ songs: [{ catalog_id: "theirs", isrc: "X" }] }),
    );

    expect((result as NextResponse).status).toBe(403);
  });

  it("returns the validated body plus the authenticated account on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);

    const result = await validateCatalogSongsRequest(
      post({ songs: [{ catalog_id: "mine", isrc: "X" }] }),
    );

    expect(result).toMatchObject({
      accountId: "acc_1",
      songs: [{ catalog_id: "mine", isrc: "X" }],
    });
  });

  it("checks every catalog named in the body, not just the first", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);

    await validateCatalogSongsRequest(
      post({
        songs: [
          { catalog_id: "mine", isrc: "X" },
          { catalog_id: "theirs", isrc: "Y" },
        ],
      }),
    );

    expect(authorizeCatalogAccess).toHaveBeenCalledWith("acc_1", ["mine", "theirs"]);
  });
});

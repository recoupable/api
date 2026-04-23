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

const UUID = "11111111-1111-4111-8111-111111111111";
const makeReq = (url: string) => new NextRequest(url, { headers: { authorization: "Bearer t" } });

describe("validateGetSongsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateAuthContext.mockResolvedValue({ accountId: "a", orgId: null });
  });

  it("returns auth failure verbatim without parsing query", async () => {
    mockValidateAuthContext.mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );
    const res = await validateGetSongsRequest(
      new NextRequest(`https://x/api/songs?artist_account_id=bad`),
    );
    expect((res as NextResponse).status).toBe(401);
  });

  it("does not pass query id as an accountId override to validateAuthContext", async () => {
    await validateGetSongsRequest(makeReq(`https://x/api/songs?artist_account_id=${UUID}`));
    expect(mockValidateAuthContext.mock.calls[0][1]).toBeUndefined();
  });

  it.each([
    ["isrc=USRC17607839", { isrc: "USRC17607839" }],
    [`artist_account_id=${UUID}`, { artist_account_id: UUID }],
    ["", {}],
  ])("returns parsed params for %s", async (qs, expected) => {
    const res = await validateGetSongsRequest(makeReq(`https://x/api/songs?${qs}`));
    expect(res).toEqual(expected);
  });

  it.each([
    ["artist_account_id=not-a-uuid", "artist_account_id"],
    ["isrc=%20%20", "isrc"],
  ])("returns 400 for %s", async (qs, field) => {
    const res = await validateGetSongsRequest(makeReq(`https://x/api/songs?${qs}`));
    expect((res as NextResponse).status).toBe(400);
    const body = await (res as NextResponse).json();
    expect(body.missing_fields).toEqual([field]);
  });
});

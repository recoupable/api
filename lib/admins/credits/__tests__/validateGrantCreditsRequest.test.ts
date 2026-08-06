import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockValidateAdminAuth = vi.fn();
vi.mock("@/lib/admins/validateAdminAuth", () => ({
  validateAdminAuth: (...args: unknown[]) => mockValidateAdminAuth(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({}),
}));

const { validateGrantCreditsRequest } = await import("../validateGrantCreditsRequest");

const ACCOUNT = "fb678396-a68f-4294-ae50-b8cacf9ce77b";
const ADMIN = "22222222-2222-2222-2222-222222222222";
const mockAuth = { accountId: ADMIN, orgId: null, authToken: "token" };

function postRequest(body: unknown, raw?: string) {
  return new NextRequest("http://localhost/api/admins/credits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateAdminAuth.mockResolvedValue(mockAuth);
});

describe("validateGrantCreditsRequest", () => {
  it("returns the parsed grant plus the acting admin on a valid body", async () => {
    const result = await validateGrantCreditsRequest(
      postRequest({
        account_id: ACCOUNT,
        remaining_credits: 9999,
        reason: "Trial headroom for the Aug 12 label demo",
      }),
    );

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountId: ACCOUNT,
      remainingCredits: 9999,
      reason: "Trial headroom for the Aug 12 label demo",
      grantedBy: ADMIN,
    });
  });

  it("takes granted_by from the credentials, never from the body", async () => {
    const result = await validateGrantCreditsRequest(
      postRequest({
        account_id: ACCOUNT,
        remaining_credits: 100,
        reason: "ok",
        granted_by: "99999999-9999-9999-9999-999999999999",
      }),
    );

    expect(result).toMatchObject({ grantedBy: ADMIN });
  });

  it("trims the reason before storing it", async () => {
    const result = await validateGrantCreditsRequest(
      postRequest({ account_id: ACCOUNT, remaining_credits: 100, reason: "  padded  " }),
    );

    expect(result).toMatchObject({ reason: "padded" });
  });

  it("passes the auth failure straight through", async () => {
    mockValidateAdminAuth.mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );

    const result = await validateGrantCreditsRequest(
      postRequest({ account_id: ACCOUNT, remaining_credits: 100, reason: "ok" }),
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("passes a non-admin 403 straight through, without parsing the body", async () => {
    mockValidateAdminAuth.mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 403 }),
    );

    const result = await validateGrantCreditsRequest(postRequest({}, "not json at all"));

    expect((result as NextResponse).status).toBe(403);
  });

  it.each([
    ["a missing account_id", { remaining_credits: 100, reason: "ok" }],
    ["a non-UUID account_id", { account_id: "nope", remaining_credits: 100, reason: "ok" }],
    ["a missing reason", { account_id: ACCOUNT, remaining_credits: 100 }],
    ["an empty reason", { account_id: ACCOUNT, remaining_credits: 100, reason: "" }],
    ["a whitespace-only reason", { account_id: ACCOUNT, remaining_credits: 100, reason: "   " }],
    ["a missing remaining_credits", { account_id: ACCOUNT, reason: "ok" }],
    ["a negative remaining_credits", { account_id: ACCOUNT, remaining_credits: -1, reason: "ok" }],
    [
      "a fractional remaining_credits",
      { account_id: ACCOUNT, remaining_credits: 10.5, reason: "ok" },
    ],
    ["a string remaining_credits", { account_id: ACCOUNT, remaining_credits: "100", reason: "ok" }],
  ])("rejects %s with a 400", async (_label, body) => {
    const result = await validateGrantCreditsRequest(postRequest(body));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);

    // Pin the envelope, not just the status: the documented 400 shape is
    // `{ status, error, missing_fields }`, and a field silently moving to
    // `message` would break the published contract while a status-only
    // assertion stayed green.
    const parsed = await (result as NextResponse).json();
    expect(parsed.status).toBe("error");
    expect(parsed.error).toBeTypeOf("string");
    expect(Array.isArray(parsed.missing_fields)).toBe(true);
    expect(parsed.missing_fields.length).toBeGreaterThan(0);
  });

  it("accepts zero, which is how an account is deliberately zeroed out", async () => {
    const result = await validateGrantCreditsRequest(
      postRequest({ account_id: ACCOUNT, remaining_credits: 0, reason: "Zeroing out a burner" }),
    );

    expect(result).toMatchObject({ remainingCredits: 0 });
  });

  it("returns 400 with the failing field path rather than throwing on a malformed body", async () => {
    const result = await validateGrantCreditsRequest(postRequest({}, "{ not json"));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.status).toBe("error");
    expect(body.error).toBeTypeOf("string");
    // No field path to report when the body never parsed — the contract
    // documents missing_fields as absent in exactly this case.
    expect(body.missing_fields).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

vi.mock("@/lib/accounts/validateUpdateAccountBody", () => ({
  validateUpdateAccountBody: vi.fn(),
}));

vi.mock("@/lib/admins/checkIsAdmin", () => ({
  checkIsAdmin: vi.fn(),
}));

vi.mock("@/lib/accounts/updateAccountHandler", () => ({
  updateAccountHandler: vi.fn(),
}));

vi.mock("@/lib/accounts/createAccountHandler", () => ({
  createAccountHandler: vi.fn(),
}));

const { PATCH } = await import("@/app/api/accounts/route");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { safeParseJson } = await import("@/lib/networking/safeParseJson");
const { validateUpdateAccountBody } = await import("@/lib/accounts/validateUpdateAccountBody");
const { checkIsAdmin } = await import("@/lib/admins/checkIsAdmin");
const { updateAccountHandler } = await import("@/lib/accounts/updateAccountHandler");

describe("PATCH /api/accounts", () => {
  const accountA = "11111111-1111-4111-8111-111111111111";
  const accountB = "22222222-2222-4222-8222-222222222222";
  const req = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error when unauthenticated", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const response = await PATCH(req);

    expect(response.status).toBe(401);
    expect(validateUpdateAccountBody).not.toHaveBeenCalled();
    expect(updateAccountHandler).not.toHaveBeenCalled();
  });

  it("updates authenticated caller account when body omits accountId", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: accountA,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({ name: "Alice" });
    vi.mocked(validateUpdateAccountBody).mockReturnValue({ name: "Alice" });
    vi.mocked(updateAccountHandler).mockResolvedValue(
      NextResponse.json({ data: { account_id: accountA } }, { status: 200 }),
    );

    const response = await PATCH(req);

    expect(response.status).toBe(200);
    expect(checkIsAdmin).not.toHaveBeenCalled();
    expect(updateAccountHandler).toHaveBeenCalledWith({
      name: "Alice",
      accountId: accountA,
    });
  });

  it("rejects cross-account override for non-admin", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: accountA,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({
      accountId: accountB,
      name: "Bob",
    });
    vi.mocked(validateUpdateAccountBody).mockReturnValue({
      accountId: accountB,
      name: "Bob",
    });
    vi.mocked(checkIsAdmin).mockResolvedValue(false);

    const response = await PATCH(req);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("accountId override is only allowed for admin accounts");
    expect(updateAccountHandler).not.toHaveBeenCalled();
  });

  it("allows cross-account override for admin", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: accountA,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({
      accountId: accountB,
      name: "Bob",
    });
    vi.mocked(validateUpdateAccountBody).mockReturnValue({
      accountId: accountB,
      name: "Bob",
    });
    vi.mocked(checkIsAdmin).mockResolvedValue(true);
    vi.mocked(updateAccountHandler).mockResolvedValue(
      NextResponse.json({ data: { account_id: accountB } }, { status: 200 }),
    );

    const response = await PATCH(req);

    expect(response.status).toBe(200);
    expect(checkIsAdmin).toHaveBeenCalledWith(accountA);
    expect(updateAccountHandler).toHaveBeenCalledWith({
      accountId: accountB,
      name: "Bob",
    });
  });

  it("returns validation error for invalid body", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: accountA,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({ image: "bad-url" });
    vi.mocked(validateUpdateAccountBody).mockReturnValue(
      NextResponse.json({ status: "error", error: "invalid body" }, { status: 400 }),
    );

    const response = await PATCH(req);

    expect(response.status).toBe(400);
    expect(updateAccountHandler).not.toHaveBeenCalled();
  });
});

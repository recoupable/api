import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { patchAccountHandler } from "@/lib/accounts/patchAccountHandler";

vi.mock("@/lib/accounts/validateUpdateAccountBody", () => ({
  validatePatchAccountRequest: vi.fn(),
}));

vi.mock("@/lib/admins/checkIsAdmin", () => ({
  checkIsAdmin: vi.fn(),
}));

vi.mock("@/lib/accounts/updateAccountHandler", () => ({
  updateAccountHandler: vi.fn(),
}));

const { validatePatchAccountRequest } = await import("@/lib/accounts/validateUpdateAccountBody");
const { checkIsAdmin } = await import("@/lib/admins/checkIsAdmin");
const { updateAccountHandler } = await import("@/lib/accounts/updateAccountHandler");

describe("patchAccountHandler", () => {
  const accountA = "11111111-1111-4111-8111-111111111111";
  const accountB = "22222222-2222-4222-8222-222222222222";
  const req = {} as NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error when validatePatchAccountRequest rejects auth", async () => {
    vi.mocked(validatePatchAccountRequest).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const response = await patchAccountHandler(req);

    expect(response.status).toBe(401);
    expect(updateAccountHandler).not.toHaveBeenCalled();
  });

  it("updates authenticated caller account when body omits accountId", async () => {
    vi.mocked(validatePatchAccountRequest).mockResolvedValue({
      auth: { accountId: accountA, orgId: null, authToken: "token" },
      body: { name: "Alice" },
    });
    vi.mocked(updateAccountHandler).mockResolvedValue(
      NextResponse.json({ data: { account_id: accountA } }, { status: 200 }),
    );

    const response = await patchAccountHandler(req);

    expect(response.status).toBe(200);
    expect(checkIsAdmin).not.toHaveBeenCalled();
    expect(updateAccountHandler).toHaveBeenCalledWith({
      name: "Alice",
      accountId: accountA,
    });
  });

  it("rejects cross-account override for non-admin", async () => {
    vi.mocked(validatePatchAccountRequest).mockResolvedValue({
      auth: { accountId: accountA, orgId: null, authToken: "token" },
      body: { accountId: accountB, name: "Bob" },
    });
    vi.mocked(checkIsAdmin).mockResolvedValue(false);

    const response = await patchAccountHandler(req);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("accountId override is only allowed for admin accounts");
    expect(updateAccountHandler).not.toHaveBeenCalled();
  });

  it("allows cross-account override for admin", async () => {
    vi.mocked(validatePatchAccountRequest).mockResolvedValue({
      auth: { accountId: accountA, orgId: null, authToken: "token" },
      body: { accountId: accountB, name: "Bob" },
    });
    vi.mocked(checkIsAdmin).mockResolvedValue(true);
    vi.mocked(updateAccountHandler).mockResolvedValue(
      NextResponse.json({ data: { account_id: accountB } }, { status: 200 }),
    );

    const response = await patchAccountHandler(req);

    expect(response.status).toBe(200);
    expect(checkIsAdmin).toHaveBeenCalledWith(accountA);
    expect(updateAccountHandler).toHaveBeenCalledWith({
      accountId: accountB,
      name: "Bob",
    });
  });

  it("returns validation error when body validation fails", async () => {
    vi.mocked(validatePatchAccountRequest).mockResolvedValue(
      NextResponse.json({ status: "error", error: "invalid body" }, { status: 400 }),
    );

    const response = await patchAccountHandler(req);

    expect(response.status).toBe(400);
    expect(updateAccountHandler).not.toHaveBeenCalled();
  });
});

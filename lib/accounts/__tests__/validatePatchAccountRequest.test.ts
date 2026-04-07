import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validatePatchAccountRequest } from "@/lib/accounts/validateUpdateAccountBody";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { safeParseJson } = await import("@/lib/networking/safeParseJson");

describe("validatePatchAccountRequest", () => {
  const accountA = "11111111-1111-4111-8111-111111111111";
  const req = {} as NextRequest;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when validateAuthContext returns error response", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validatePatchAccountRequest(req);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(safeParseJson).not.toHaveBeenCalled();
  });

  it("returns 400 when body fails schema validation", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: accountA,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({});

    const result = await validatePatchAccountRequest(req);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns auth and validated body on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: accountA,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(safeParseJson).mockResolvedValue({ name: "Alice" });

    const result = await validatePatchAccountRequest(req);

    expect(result).toEqual({
      auth: { accountId: accountA, orgId: null, authToken: "token" },
      body: { name: "Alice" },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

vi.mock("@/lib/accounts/validateCreateAccountBody", () => ({
  validateCreateAccountBody: vi.fn(),
}));

vi.mock("@/lib/accounts/createAccountHandler", () => ({
  createAccountHandler: vi.fn(),
}));

vi.mock("@/lib/accounts/patchAccountHandler", () => ({
  patchAccountHandler: vi.fn(),
}));

const { POST, PATCH } = await import("@/app/api/accounts/route");
const { safeParseJson } = await import("@/lib/networking/safeParseJson");
const { validateCreateAccountBody } = await import("@/lib/accounts/validateCreateAccountBody");
const { createAccountHandler } = await import("@/lib/accounts/createAccountHandler");
const { patchAccountHandler } = await import("@/lib/accounts/patchAccountHandler");

describe("POST /api/accounts", () => {
  const req = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation error when body invalid", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({});
    vi.mocked(validateCreateAccountBody).mockReturnValue(
      NextResponse.json({ status: "error" }, { status: 400 }),
    );

    const response = await POST(req);

    expect(response.status).toBe(400);
    expect(createAccountHandler).not.toHaveBeenCalled();
  });

  it("delegates to createAccountHandler when body valid", async () => {
    const payload = { email: "a@b.com" };
    vi.mocked(safeParseJson).mockResolvedValue(payload);
    vi.mocked(validateCreateAccountBody).mockReturnValue(payload as never);
    vi.mocked(createAccountHandler).mockResolvedValue(NextResponse.json({ ok: true }));

    await POST(req);

    expect(createAccountHandler).toHaveBeenCalledWith(payload);
  });
});

describe("PATCH /api/accounts", () => {
  const req = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to patchAccountHandler", async () => {
    const expected = NextResponse.json({ data: {} }, { status: 200 });
    vi.mocked(patchAccountHandler).mockResolvedValue(expected);

    const response = await PATCH(req);

    expect(patchAccountHandler).toHaveBeenCalledWith(req);
    expect(response).toBe(expected);
  });
});

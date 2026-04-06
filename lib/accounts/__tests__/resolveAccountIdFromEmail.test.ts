import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { resolveAccountIdFromEmail } from "../resolveAccountIdFromEmail";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountByEmail", () => ({
  selectAccountByEmail: vi.fn(),
}));

describe("resolveAccountIdFromEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns accountId when email has an associated account", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue({
      account_id: "account-123",
      email: "test@example.com",
    } as any);

    const result = await resolveAccountIdFromEmail("test@example.com");

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toBe("account-123");
    expect(selectAccountByEmail).toHaveBeenCalledWith("test@example.com");
  });

  it("returns 404 when email has no associated account", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue(null);

    const result = await resolveAccountIdFromEmail("unknown@example.com");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns 404 when account_id is null", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue({
      account_id: null,
      email: "test@example.com",
    } as any);

    const result = await resolveAccountIdFromEmail("test@example.com");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });
});

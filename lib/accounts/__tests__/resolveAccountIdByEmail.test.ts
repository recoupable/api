import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { resolveAccountIdByEmail } from "../resolveAccountIdByEmail";
import { selectAccountByEmail } from "@/lib/supabase/account_emails/selectAccountByEmail";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountByEmail", () => ({
  selectAccountByEmail: vi.fn(),
}));

describe("resolveAccountIdByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns accountId when email resolves", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue({
      account_id: "customer-456",
      email: "test@example.com",
    } as unknown);

    const result = await resolveAccountIdByEmail("test@example.com");

    expect(result).toBe("customer-456");
    expect(selectAccountByEmail).toHaveBeenCalledWith("test@example.com");
  });

  it("returns 404 when email not found", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue(null);

    const result = await resolveAccountIdByEmail("unknown@example.com");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns 404 when account_id is null", async () => {
    vi.mocked(selectAccountByEmail).mockResolvedValue({
      account_id: null,
      email: "test@example.com",
    } as unknown);

    const result = await resolveAccountIdByEmail("test@example.com");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });
});

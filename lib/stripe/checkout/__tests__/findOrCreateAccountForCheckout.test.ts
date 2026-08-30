import { describe, it, expect, vi, beforeEach } from "vitest";

const { selectByEmailMock, getOrCreateMock, welcomeMock } = vi.hoisted(() => ({
  selectByEmailMock: vi.fn(),
  getOrCreateMock: vi.fn(),
  welcomeMock: vi.fn(),
}));
vi.mock("@/lib/supabase/account_emails/selectAccountEmail", () => ({
  selectAccountEmail: selectByEmailMock,
}));
vi.mock("@/lib/accounts/getOrCreateAccountByEmail", () => ({
  getOrCreateAccountByEmail: getOrCreateMock,
}));
vi.mock("@/lib/emails/sendWelcomeEmail", () => ({ sendWelcomeEmail: welcomeMock }));

const { findOrCreateAccountForCheckout } = await import("../findOrCreateAccountForCheckout");

describe("findOrCreateAccountForCheckout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the existing account without a welcome email", async () => {
    selectByEmailMock.mockResolvedValue({ account_id: "acc_existing" });
    expect(await findOrCreateAccountForCheckout("fan@example.com")).toEqual({
      accountId: "acc_existing",
      created: false,
    });
    expect(getOrCreateMock).not.toHaveBeenCalled();
    expect(welcomeMock).not.toHaveBeenCalled();
  });

  it("creates the account and sends the welcome email when none exists", async () => {
    selectByEmailMock.mockResolvedValue(null);
    getOrCreateMock.mockResolvedValue("acc_new");
    expect(await findOrCreateAccountForCheckout("fan@example.com")).toEqual({
      accountId: "acc_new",
      created: true,
    });
    expect(welcomeMock).toHaveBeenCalledWith({ accountId: "acc_new", email: "fan@example.com" });
  });

  it("throws when the account could not be created (so Stripe retries the webhook)", async () => {
    selectByEmailMock.mockResolvedValue(null);
    getOrCreateMock.mockResolvedValue(null);
    await expect(findOrCreateAccountForCheckout("fan@example.com")).rejects.toThrow(
      /could not create/,
    );
  });
});

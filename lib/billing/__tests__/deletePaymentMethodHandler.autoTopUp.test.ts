import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { deletePaymentMethodHandler } from "../deletePaymentMethodHandler";

const mocks = vi.hoisted(() => ({
  validate: vi.fn(),
  customer: vi.fn(),
  card: vi.fn(),
  detach: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/lib/billing/validateGetPaymentMethodParams", () => ({
  validateGetPaymentMethodParams: mocks.validate,
}));
vi.mock("@/lib/stripe/findStripeCustomerForAccount", () => ({
  findStripeCustomerForAccount: mocks.customer,
}));
vi.mock("@/lib/stripe/findDefaultCardForCustomer", () => ({
  findDefaultCardForCustomer: mocks.card,
}));
vi.mock("@/lib/stripe/detachPaymentMethod", () => ({ detachPaymentMethod: mocks.detach }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: mocks.from } }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const remove = () =>
  deletePaymentMethodHandler(
    new NextRequest("http://localhost/payment-method", { method: "DELETE" }),
    Promise.resolve({ id: ACCOUNT }),
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.validate.mockResolvedValue(ACCOUNT);
  mocks.customer.mockResolvedValue("cus_primary");
  mocks.card.mockResolvedValue("pm_primary");
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
});
describe("card removal auto-top-up persistence", () => {
  it("disables only the authorized account before detaching its selected card", async () => {
    const response = await remove();
    expect(response.status).toBe(204);
    expect(mocks.from).toHaveBeenCalledWith("credits_usage");
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ auto_topup_enabled: false });
    expect(mocks.eq).toHaveBeenCalledWith("account_id", ACCOUNT);
    expect(mocks.detach).toHaveBeenCalledExactlyOnceWith("pm_primary");
    expect(mocks.eq.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.detach.mock.invocationCallOrder[0],
    );
  });
  it("does not detach or report success when disabling fails", async () => {
    mocks.eq.mockResolvedValue({ error: new Error("database unavailable") });
    const response = await remove();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(mocks.detach).not.toHaveBeenCalled();
  });
  it("supports an account without a credits row without provisioning one", async () => {
    mocks.eq.mockResolvedValue({ error: null, data: [] });
    expect((await remove()).status).toBe(204);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ auto_topup_enabled: false });
  });
  it("keeps top-up disabled if detaching subsequently fails", async () => {
    mocks.detach.mockRejectedValue(new Error("Stripe unavailable"));
    expect((await remove()).status).toBe(500);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ auto_topup_enabled: false });
  });
  it("does not change settings when no card exists", async () => {
    mocks.card.mockResolvedValue(null);
    expect((await remove()).status).toBe(404);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not change settings for an unauthorized request", async () => {
    mocks.validate.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    expect((await remove()).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

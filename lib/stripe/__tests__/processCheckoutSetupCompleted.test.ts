import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { setupIntentsRetrieve, setDefaultPaymentMethodMock, isNewerPaymentMethodMock } = vi.hoisted(
  () => ({
    setupIntentsRetrieve: vi.fn(),
    setDefaultPaymentMethodMock: vi.fn(),
    isNewerPaymentMethodMock: vi.fn(),
  }),
);
vi.mock("@/lib/stripe/client", () => ({
  default: { setupIntents: { retrieve: setupIntentsRetrieve } },
}));
vi.mock("@/lib/stripe/isNewerPaymentMethod", () => ({
  isNewerPaymentMethod: isNewerPaymentMethodMock,
}));
vi.mock("@/lib/stripe/setDefaultPaymentMethod", () => ({
  setDefaultPaymentMethod: setDefaultPaymentMethodMock,
}));

const { processCheckoutSetupCompleted } = await import(
  "@/lib/stripe/processCheckoutSetupCompleted"
);

const session = (overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session =>
  ({
    id: "cs_1",
    mode: "setup",
    customer: "cus_x",
    setup_intent: "seti_1",
    ...overrides,
  }) as Stripe.Checkout.Session;

describe("processCheckoutSetupCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNewerPaymentMethodMock.mockResolvedValue(true);
  });

  it("skips the update when the current default is newer than the saved card (out-of-order events)", async () => {
    setupIntentsRetrieve.mockResolvedValue({ id: "seti_1", payment_method: "pm_old" });
    isNewerPaymentMethodMock.mockResolvedValue(false);

    await processCheckoutSetupCompleted(session());

    expect(isNewerPaymentMethodMock).toHaveBeenCalledWith("cus_x", "pm_old");
    expect(setDefaultPaymentMethodMock).not.toHaveBeenCalled();
  });

  it("makes the saved card the customer's invoice default", async () => {
    setupIntentsRetrieve.mockResolvedValue({ id: "seti_1", payment_method: "pm_new" });

    await processCheckoutSetupCompleted(session());

    expect(setupIntentsRetrieve).toHaveBeenCalledWith("seti_1");
    expect(setDefaultPaymentMethodMock).toHaveBeenCalledWith("cus_x", "pm_new");
  });

  it("accepts expanded customer and setup_intent objects", async () => {
    setupIntentsRetrieve.mockResolvedValue({
      id: "seti_1",
      payment_method: { id: "pm_obj" },
    });
    await processCheckoutSetupCompleted(
      session({
        customer: { id: "cus_obj" } as Stripe.Customer,
        setup_intent: { id: "seti_1" } as Stripe.SetupIntent,
      }),
    );
    expect(setDefaultPaymentMethodMock).toHaveBeenCalledWith("cus_obj", "pm_obj");
  });

  it("ignores non-setup sessions", async () => {
    await processCheckoutSetupCompleted(session({ mode: "payment" }));
    expect(setupIntentsRetrieve).not.toHaveBeenCalled();
    expect(setDefaultPaymentMethodMock).not.toHaveBeenCalled();
  });

  it("does nothing when the session has no customer or setup intent", async () => {
    await processCheckoutSetupCompleted(session({ customer: null }));
    await processCheckoutSetupCompleted(session({ setup_intent: null }));
    expect(setDefaultPaymentMethodMock).not.toHaveBeenCalled();
  });

  it("does nothing when the setup intent has no payment method", async () => {
    setupIntentsRetrieve.mockResolvedValue({ id: "seti_1", payment_method: null });
    await processCheckoutSetupCompleted(session());
    expect(setDefaultPaymentMethodMock).not.toHaveBeenCalled();
  });
});

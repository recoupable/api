import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { startMock } = vi.hoisted(() => ({ startMock: vi.fn() }));
vi.mock("workflow/api", () => ({ start: startMock }));
vi.mock("@/app/workflows/abandonedCheckoutWorkflow", () => ({
  abandonedCheckoutWorkflow: "abandonedCheckoutWorkflow",
}));

const { processCheckoutSessionExpired } = await import(
  "@/lib/stripe/processCheckoutSessionExpired"
);

const session = (overrides: Partial<Stripe.Checkout.Session>) =>
  ({
    id: "cs_1",
    mode: "subscription",
    customer_details: { email: "Fan@Example.com" },
    metadata: { plan: "starter" },
    ...overrides,
  }) as unknown as Stripe.Checkout.Session;

describe("processCheckoutSessionExpired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startMock.mockResolvedValue({ runId: "run_1" });
  });

  it("starts the delayed abandoned-checkout workflow for a subscription session with an email", async () => {
    await processCheckoutSessionExpired(session({}));
    expect(startMock).toHaveBeenCalledWith("abandonedCheckoutWorkflow", [
      { sessionId: "cs_1", email: "fan@example.com", plan: "starter" },
    ]);
  });

  it("logs the run id with the session id so the run can be found later", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await processCheckoutSessionExpired(session({}));
    expect(log).toHaveBeenCalledWith("[processCheckoutSessionExpired] workflow started", {
      sessionId: "cs_1",
      runId: "run_1",
    });
    log.mockRestore();
  });

  it("defaults the plan to pro when the session carries none", async () => {
    await processCheckoutSessionExpired(session({ metadata: {} }));
    expect(startMock.mock.calls[0][1][0].plan).toBe("pro");
  });

  it("ignores payment-mode sessions and sessions without an email", async () => {
    await processCheckoutSessionExpired(session({ mode: "payment" }));
    await processCheckoutSessionExpired(session({ customer_details: null, customer_email: null }));
    expect(startMock).not.toHaveBeenCalled();
  });
});

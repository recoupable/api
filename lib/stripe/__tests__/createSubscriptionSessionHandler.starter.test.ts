import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSubscriptionSessionHandler } from "@/lib/stripe/createSubscriptionSessionHandler";
import { validateCreateSubscriptionSessionRequest } from "@/lib/stripe/validateCreateSubscriptionSessionRequest";
import { createStripeSession } from "@/lib/stripe/createStripeSession";
import { StarterUnavailableError } from "@/lib/stripe/StarterUnavailableError";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/stripe/validateCreateSubscriptionSessionRequest", () => ({
  validateCreateSubscriptionSessionRequest: vi.fn(),
}));
vi.mock("@/lib/stripe/createStripeSession", () => ({ createStripeSession: vi.fn() }));

const req = () =>
  new NextRequest("http://localhost/api/subscriptions/sessions", { method: "POST", body: "{}" });

describe("createSubscriptionSessionHandler starter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("passes the validated plan through to createStripeSession", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      accountId: "acc",
      successUrl: "https://x.y/ok",
      plan: "starter",
    });
    vi.mocked(createStripeSession).mockResolvedValue({ id: "cs", url: "https://s" } as never);
    const res = await createSubscriptionSessionHandler(req());
    expect(res.status).toBe(200);
    expect(createStripeSession).toHaveBeenCalledWith("acc", "https://x.y/ok", "starter");
  });

  it("maps StarterUnavailableError to 400 starter_unavailable", async () => {
    vi.mocked(validateCreateSubscriptionSessionRequest).mockResolvedValue({
      accountId: "acc",
      successUrl: "https://x.y/ok",
      plan: "starter",
    });
    vi.mocked(createStripeSession).mockRejectedValue(new StarterUnavailableError());
    const res = await createSubscriptionSessionHandler(req());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "starter_unavailable" });
  });
});

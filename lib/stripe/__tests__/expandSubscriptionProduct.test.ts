import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";
import { expandSubscriptionProduct } from "@/lib/stripe/expandSubscriptionProduct";

vi.mock("@/lib/stripe/client", () => ({
  default: { products: { retrieve: vi.fn() } },
}));

const sub = (price: Record<string, unknown>) =>
  ({ id: "sub_1", items: { data: [{ price }] } }) as unknown as Stripe.Subscription;

describe("expandSubscriptionProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for null", async () => {
    expect(await expandSubscriptionProduct(null)).toBeNull();
    expect(stripeClient.products.retrieve).not.toHaveBeenCalled();
  });

  it("leaves a subscription alone when the price has a nickname", async () => {
    const s = sub({ nickname: "Pro", product: "prod_1" });
    expect(await expandSubscriptionProduct(s)).toBe(s);
    expect(stripeClient.products.retrieve).not.toHaveBeenCalled();
  });

  it("retrieves the product when the price has no nickname and product is an id", async () => {
    vi.mocked(stripeClient.products.retrieve).mockResolvedValue({
      id: "prod_1",
      name: "Recoupable Pro",
    } as never);
    const out = await expandSubscriptionProduct(sub({ nickname: null, product: "prod_1" }));
    expect(stripeClient.products.retrieve).toHaveBeenCalledWith("prod_1");
    expect((out?.items.data[0].price.product as Stripe.Product).name).toBe("Recoupable Pro");
  });

  it("returns the subscription unchanged when the product lookup fails", async () => {
    vi.mocked(stripeClient.products.retrieve).mockRejectedValue(new Error("nope"));
    const s = sub({ nickname: null, product: "prod_1" });
    expect(await expandSubscriptionProduct(s)).toBe(s);
  });
});

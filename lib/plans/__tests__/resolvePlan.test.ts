import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stripe/config", () => ({ STRIPE_STARTER_PRICE_ID: "price_starter" }));

const { resolvePlan } = await import("@/lib/plans/resolvePlan");

const sub = (priceId: string, status = "active") =>
  ({
    id: "sub_1",
    status,
    canceled_at: null,
    items: { data: [{ price: { id: priceId } }] },
  }) as never;

describe("resolvePlan", () => {
  it("free when nothing is active", () => {
    expect(resolvePlan({ accountSub: null, orgSub: null, isEnterprise: false })).toBe("free");
  });

  it("starter when the account subscription is on the Starter price", () => {
    expect(
      resolvePlan({ accountSub: sub("price_starter"), orgSub: null, isEnterprise: false }),
    ).toBe("starter");
  });

  it("pro for any other active account price", () => {
    expect(resolvePlan({ accountSub: sub("price_pro"), orgSub: null, isEnterprise: false })).toBe(
      "pro",
    );
  });

  it("pro via organization or enterprise even when the account sub is starter", () => {
    expect(
      resolvePlan({
        accountSub: sub("price_starter"),
        orgSub: sub("price_pro"),
        isEnterprise: false,
      }),
    ).toBe("pro");
    expect(
      resolvePlan({ accountSub: sub("price_starter"), orgSub: null, isEnterprise: true }),
    ).toBe("pro");
  });

  it("ignores a canceled account subscription", () => {
    expect(
      resolvePlan({
        accountSub: sub("price_starter", "canceled"),
        orgSub: null,
        isEnterprise: false,
      }),
    ).toBe("free");
  });
});

import type Stripe from "stripe";

export const activeSub = (status: Stripe.Subscription.Status = "active") =>
  ({
    status,
    canceled_at: null,
    collection_method: "charge_automatically",
    current_period_end: 1790380800,
    items: {
      data: [
        {
          price: {
            id: "price_pro",
            nickname: "Pro",
            unit_amount: 9900,
            currency: "usd",
            recurring: { interval: "month" },
            product: "prod_pro",
          },
        },
      ],
    },
  }) as unknown as Stripe.Subscription;

export const nullDetails = {
  name: null,
  amountCents: null,
  currency: null,
  interval: null,
  collectionMethod: null,
  currentPeriodEnd: null,
};

export const proDetails = {
  name: "Pro",
  amountCents: 9900,
  currency: "usd",
  interval: "month",
  collectionMethod: "charge_automatically",
  currentPeriodEnd: "2026-09-26T00:00:00.000Z",
};

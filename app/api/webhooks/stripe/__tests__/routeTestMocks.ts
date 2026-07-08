import { vi } from "vitest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/verifyStripeWebhookEvent", () => ({
  verifyStripeWebhookEvent: vi.fn(),
}));

vi.mock("@/lib/stripe/processCreditsTopupSession", () => ({
  processCreditsTopupSession: vi.fn(),
}));

vi.mock("@/lib/stripe/processCreditsTopupPaymentIntent", () => ({
  processCreditsTopupPaymentIntent: vi.fn(),
}));

vi.mock("@/lib/stripe/processSubscriptionCreated", () => ({
  processSubscriptionCreated: vi.fn(),
}));

vi.mock("@/lib/stripe/processSubscriptionTrialWillEnd", () => ({
  processSubscriptionTrialWillEnd: vi.fn(),
}));

vi.mock("@/lib/stripe/processSubscriptionUpdated", () => ({
  processSubscriptionUpdated: vi.fn(),
}));

vi.mock("@/lib/stripe/processSubscriptionDeleted", () => ({
  processSubscriptionDeleted: vi.fn(),
}));

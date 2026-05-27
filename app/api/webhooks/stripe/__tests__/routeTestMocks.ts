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

import { vi } from "vitest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/stripe/validateCreateCreditsSessionRequest", () => ({
  validateCreateCreditsSessionRequest: vi.fn(),
}));
vi.mock("@/lib/stripe/resolveStripeCustomerForAccount", () => ({
  resolveStripeCustomerForAccount: vi.fn(),
}));
vi.mock("@/lib/stripe/chargeCustomerOffSession", () => ({
  chargeCustomerOffSession: vi.fn(),
}));
vi.mock("@/lib/stripe/createCreditsStripeSession", () => ({
  createCreditsStripeSession: vi.fn(),
}));

export const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
export const validated = {
  accountId: ACCOUNT,
  successUrl: "https://chat.recoupable.com/ok",
  credits: 250,
};

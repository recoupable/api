import { vi } from "vitest";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateCreatePortalSessionRequest", () => ({
  validateCreatePortalSessionRequest: vi.fn(),
}));

vi.mock("@/lib/stripe/createPortalSession", () => ({
  createPortalSession: vi.fn(),
}));

vi.mock("@/lib/supabase/billing_customers/getStripeCustomerIdByAccountId", () => ({
  getStripeCustomerIdByAccountId: vi.fn(),
}));

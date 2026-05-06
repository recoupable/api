import { vi } from "vitest";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/stripe/validateCreateSubscriptionPortalBody", () => ({
  validateCreateSubscriptionPortalBody: vi.fn(),
}));

vi.mock("@/lib/supabase/billing_customers/selectBillingCustomers", () => ({
  selectBillingCustomers: vi.fn(),
}));

vi.mock("@/lib/stripe/createBillingPortalSession", () => ({
  createBillingPortalSession: vi.fn(),
}));

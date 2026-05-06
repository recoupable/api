import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { validateCreateSubscriptionPortalBody } from "@/lib/stripe/validateCreateSubscriptionPortalBody";
import { createBillingPortalSession } from "@/lib/stripe/createBillingPortalSession";
import { selectBillingCustomers } from "@/lib/supabase/billing_customers/selectBillingCustomers";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";

describe("POST /api/subscriptions/portal (200)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSubscriptionPortalBody).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns id and url when portal session is created", async () => {
    vi.mocked(validateCreateSubscriptionPortalBody).mockResolvedValue({
      accountId: ACCOUNT,
      returnUrl: "https://chat.recoupable.com/billing",
    });
    vi.mocked(selectBillingCustomers).mockResolvedValue([
      {
        id: 1,
        account_id: ACCOUNT,
        customer_id: "cus_test_123",
        email: null,
        provider: "stripe",
      },
    ]);
    vi.mocked(createBillingPortalSession).mockResolvedValue({
      id: "bps_test_abc",
      url: "https://billing.example.com/session/abc",
    } as Awaited<ReturnType<typeof createBillingPortalSession>>);
    const res = await POST(
      new NextRequest("http://localhost/api/subscriptions/portal", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "bps_test_abc",
      url: "https://billing.example.com/session/abc",
    });
  });
});

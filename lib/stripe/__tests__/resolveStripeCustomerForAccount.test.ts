import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { customersSearch, customersCreate } = vi.hoisted(() => ({
  customersSearch: vi.fn(),
  customersCreate: vi.fn(),
}));

vi.mock("@/lib/stripe/client", () => ({
  default: {
    customers: {
      search: customersSearch,
      create: customersCreate,
    },
  },
}));

const { resolveStripeCustomerForAccount } = await import(
  "@/lib/stripe/resolveStripeCustomerForAccount"
);

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const customer = (id: string, created: number, pm: string | null = null) => ({
  id,
  created,
  invoice_settings: { default_payment_method: pm },
});

const searchResult = (
  customers: Array<{ id: string; created?: number }>,
): Stripe.ApiSearchResult<Stripe.Customer> =>
  ({
    object: "search_result",
    has_more: false,
    next_page: null,
    url: "/v1/customers/search",
    data: customers as unknown as Stripe.Customer[],
  }) as unknown as Stripe.ApiSearchResult<Stripe.Customer>;

describe("resolveStripeCustomerForAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing Customer ID when search finds one", async () => {
    customersSearch.mockResolvedValue(searchResult([{ id: "cus_existing" }]));

    const result = await resolveStripeCustomerForAccount(ACCOUNT);

    expect(result).toBe("cus_existing");
    expect(customersSearch).toHaveBeenCalledWith({
      query: `metadata['accountId']:'${ACCOUNT}'`,
      limit: 10,
    });
    expect(customersCreate).not.toHaveBeenCalled();
  });

  it("creates a new Customer stamped with metadata.accountId when search finds nothing", async () => {
    customersSearch.mockResolvedValue(searchResult([]));
    customersCreate.mockResolvedValue({ id: "cus_new" });

    const result = await resolveStripeCustomerForAccount(ACCOUNT);

    expect(result).toBe("cus_new");
    expect(customersCreate).toHaveBeenCalledWith(
      { metadata: { accountId: ACCOUNT } },
      { idempotencyKey: ACCOUNT },
    );
  });

  it("uses accountId as the Stripe idempotency key so back-to-back creates dedupe", async () => {
    customersSearch.mockResolvedValue(searchResult([]));
    customersCreate.mockResolvedValue({ id: "cus_new" });

    await resolveStripeCustomerForAccount(ACCOUNT);
    await resolveStripeCustomerForAccount(ACCOUNT);

    expect(customersCreate.mock.calls[0][1]?.idempotencyKey).toBe(ACCOUNT);
    expect(customersCreate.mock.calls[1][1]?.idempotencyKey).toBe(ACCOUNT);
  });

  it("prefers the tagged Customer holding a default card when search returns several", async () => {
    customersSearch.mockResolvedValue(
      searchResult([customer("cus_invoices", 200), customer("cus_card", 100, "pm_visa")]),
    );

    const result = await resolveStripeCustomerForAccount(ACCOUNT);

    expect(result).toBe("cus_card");
    expect(customersCreate).not.toHaveBeenCalled();
  });

  it("falls back to the newest tagged Customer when none holds a card", async () => {
    customersSearch.mockResolvedValue(
      searchResult([customer("cus_old", 100), customer("cus_new", 200)]),
    );

    await expect(resolveStripeCustomerForAccount(ACCOUNT)).resolves.toBe("cus_new");
  });
});

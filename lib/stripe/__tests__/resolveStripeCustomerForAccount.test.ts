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

const searchResult = (customers: Array<{ id: string }>): Stripe.ApiSearchResult<Stripe.Customer> =>
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
      limit: 1,
    });
    expect(customersCreate).not.toHaveBeenCalled();
  });

  it("creates a new Customer stamped with metadata.accountId when search finds nothing", async () => {
    customersSearch.mockResolvedValue(searchResult([]));
    customersCreate.mockResolvedValue({ id: "cus_new" });

    const result = await resolveStripeCustomerForAccount(ACCOUNT);

    expect(result).toBe("cus_new");
    expect(customersCreate).toHaveBeenCalledWith(
      {
        metadata: { accountId: ACCOUNT },
      },
      expect.objectContaining({
        idempotencyKey: expect.stringContaining(ACCOUNT),
      }),
    );
  });

  it("uses a deterministic Stripe idempotency key derived from accountId so back-to-back creates dedupe", async () => {
    customersSearch.mockResolvedValue(searchResult([]));
    customersCreate.mockResolvedValue({ id: "cus_new" });

    await resolveStripeCustomerForAccount(ACCOUNT);
    await resolveStripeCustomerForAccount(ACCOUNT);

    const firstKey = customersCreate.mock.calls[0][1]?.idempotencyKey;
    const secondKey = customersCreate.mock.calls[1][1]?.idempotencyKey;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it("prefers the first match when search returns multiple Customers", async () => {
    customersSearch.mockResolvedValue(searchResult([{ id: "cus_first" }, { id: "cus_second" }]));

    const result = await resolveStripeCustomerForAccount(ACCOUNT);

    expect(result).toBe("cus_first");
    expect(customersCreate).not.toHaveBeenCalled();
  });
});

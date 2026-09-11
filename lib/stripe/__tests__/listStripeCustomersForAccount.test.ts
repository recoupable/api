import { describe, it, expect, vi, beforeEach } from "vitest";

const { customersSearch } = vi.hoisted(() => ({ customersSearch: vi.fn() }));

vi.mock("@/lib/stripe/client", () => ({
  default: { customers: { search: customersSearch } },
}));

const { listStripeCustomersForAccount } = await import(
  "@/lib/stripe/listStripeCustomersForAccount"
);

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.clearAllMocks());

describe("listStripeCustomersForAccount", () => {
  it("searches by metadata.accountId with a multi-customer page and returns every match", async () => {
    customersSearch.mockResolvedValue({ data: [{ id: "cus_a" }, { id: "cus_b" }] });

    const result = await listStripeCustomersForAccount(ACCOUNT);

    expect(result.map(c => c.id)).toEqual(["cus_a", "cus_b"]);
    expect(customersSearch).toHaveBeenCalledWith({
      query: `metadata['accountId']:'${ACCOUNT}'`,
      limit: 10,
    });
  });

  it("returns an empty array when nothing matches", async () => {
    customersSearch.mockResolvedValue({ data: [] });

    await expect(listStripeCustomersForAccount(ACCOUNT)).resolves.toEqual([]);
  });
});

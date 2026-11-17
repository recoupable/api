import { expect, it, vi } from "vitest";
import { hasPaidSiteSubscription } from "../hasPaidSiteSubscription";
import { readPaidSiteSubscription } from "../readPaidSiteSubscription";
import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
vi.mock("@/lib/stripe/getActiveSubscriptions", () => ({ getActiveSubscriptions: vi.fn() }));
it("preserves existing fan cache while fresh publication reads observe revocation", async () => {
  vi.mocked(getActiveSubscriptions)
    .mockResolvedValueOnce([
      { status: "active", items: { data: [{ price: { unit_amount: 100 } }] } },
    ] as never)
    .mockResolvedValue([]);
  expect(await hasPaidSiteSubscription("fresh-test-owner")).toBe(true);
  expect(await hasPaidSiteSubscription("fresh-test-owner")).toBe(true);
  expect(getActiveSubscriptions).toHaveBeenCalledTimes(1);
  expect(await readPaidSiteSubscription("fresh-test-owner")).toBe(false);
  expect(getActiveSubscriptions).toHaveBeenCalledTimes(2);
});

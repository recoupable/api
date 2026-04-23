import { describe, it, expect, vi, beforeEach } from "vitest";

import stripeClient from "@/lib/stripe/client";
import { getActiveSubscription } from "../getActiveSubscription";

vi.mock("@/lib/stripe/client", () => ({
  default: { subscriptions: { search: vi.fn() } },
}));

const searchMock = vi.mocked(stripeClient.subscriptions.search);

const accountId = "550e8400-e29b-41d4-a716-446655440000";

describe("getActiveSubscription", () => {
  beforeEach(() => {
    searchMock.mockReset();
  });

  it("queries Stripe with metadata + active status filter", async () => {
    searchMock.mockResolvedValue({ data: [] });

    await getActiveSubscription(accountId);

    expect(searchMock).toHaveBeenCalledWith({
      query: `status:"active" AND metadata["accountId"]:"${accountId}"`,
      limit: 1,
    });
  });

  it("returns the first matching subscription", async () => {
    const sub = { id: "sub_1", metadata: { accountId } };
    searchMock.mockResolvedValue({ data: [sub] });

    const result = await getActiveSubscription(accountId);

    expect(result).toBe(sub);
  });

  it("returns null when no subscription matches", async () => {
    searchMock.mockResolvedValue({ data: [] });

    const result = await getActiveSubscription(accountId);

    expect(result).toBeNull();
  });

  it("returns null and logs on Stripe error", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    searchMock.mockRejectedValue(new Error("stripe down"));

    const result = await getActiveSubscription(accountId);

    expect(result).toBeNull();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

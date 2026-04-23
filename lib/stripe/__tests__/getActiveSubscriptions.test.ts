import { describe, it, expect, vi, beforeEach } from "vitest";

import stripeClient from "@/lib/stripe/client";
import { getActiveSubscriptions } from "../getActiveSubscriptions";

vi.mock("@/lib/stripe/client", () => ({
  default: {
    subscriptions: { list: vi.fn() },
  },
}));

const listMock = vi.mocked(stripeClient.subscriptions.list);

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const otherId = "660e8400-e29b-41d4-a716-446655440000";

describe("getActiveSubscriptions", () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it("calls Stripe with limit 100 and a current_period_end.gt filter", async () => {
    listMock.mockResolvedValue({ data: [] });

    await getActiveSubscriptions(accountId);

    expect(listMock).toHaveBeenCalledTimes(1);
    const arg = listMock.mock.calls[0][0];
    expect(arg.limit).toBe(100);
    expect(typeof arg.current_period_end.gt).toBe("number");
  });

  it("filters by metadata.accountId when provided", async () => {
    listMock.mockResolvedValue({
      data: [
        { id: "sub_a", metadata: { accountId } },
        { id: "sub_b", metadata: { accountId: otherId } },
        { id: "sub_c", metadata: {} },
      ],
    });

    const result = await getActiveSubscriptions(accountId);

    expect(result.map(s => s.id)).toEqual(["sub_a"]);
  });

  it("returns all subscriptions when no accountId is provided", async () => {
    listMock.mockResolvedValue({
      data: [
        { id: "sub_a", metadata: { accountId } },
        { id: "sub_b", metadata: { accountId: otherId } },
      ],
    });

    const result = await getActiveSubscriptions();

    expect(result.map(s => s.id)).toEqual(["sub_a", "sub_b"]);
  });

  it("returns [] when Stripe throws, never propagates the error", async () => {
    listMock.mockRejectedValue(new Error("stripe 500"));

    const result = await getActiveSubscriptions(accountId);

    expect(result).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectUsagePage } from "@/lib/usage/selectUsagePage";
import { selectUsageEvents } from "@/lib/supabase/usage_events/selectUsageEvents";

vi.mock("@/lib/supabase/usage_events/selectUsageEvents", () => ({ selectUsageEvents: vi.fn() }));

const base = {
  accountId: "acct",
  from: "2026-08-01T00:00:00.000Z",
  to: "2026-08-27T00:00:00.000Z",
  limit: 20,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(selectUsageEvents).mockResolvedValue([]);
});

describe("selectUsagePage", () => {
  it("pages newest first with the cursor as the upper bound when it is inside the period", async () => {
    await selectUsagePage({
      ...base,
      sort: "created_at",
      cursor: { createdAt: "2026-08-20T10:00:00.000Z" },
    });
    expect(selectUsageEvents).toHaveBeenCalledWith({
      accountId: "acct",
      createdAfter: base.from,
      createdBefore: "2026-08-20T10:00:00.000Z",
      orderBy: "created_at",
      from: 0,
      to: 19,
    });
  });

  it("keeps the period end when the created_at cursor is later than it", async () => {
    await selectUsagePage({
      ...base,
      sort: "created_at",
      cursor: { createdAt: "2026-09-01T00:00:00.000Z" },
    });
    expect(selectUsageEvents).toHaveBeenCalledWith(
      expect.objectContaining({ createdBefore: base.to }),
    );
  });

  it("pages by cost with the keyset pair and the full period", async () => {
    await selectUsagePage({ ...base, sort: "cost", cursor: { creditsDeducted: 50000, id: "abc" } });
    expect(selectUsageEvents).toHaveBeenCalledWith({
      accountId: "acct",
      createdAfter: base.from,
      createdBefore: base.to,
      orderBy: "credits_deducted",
      costBefore: { creditsDeducted: 50000, id: "abc" },
      from: 0,
      to: 19,
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectCreditGrants } from "../selectCreditGrants";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const ACCOUNT = "11111111-1111-1111-1111-111111111111";

/** Chainable query stub — every builder method returns the same object. */
function makeQuery(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  mockSelect.mockReturnValue(query);
  mockOrder.mockReturnValue(query);
  mockEq.mockReturnValue(query);
  mockGte.mockReturnValue(query);
  mockLimit.mockReturnValue(Promise.resolve(result));
  Object.assign(query, {
    select: (...a: unknown[]) => mockSelect(...a),
    order: (...a: unknown[]) => mockOrder(...a),
    eq: (...a: unknown[]) => mockEq(...a),
    gte: (...a: unknown[]) => mockGte(...a),
    limit: (...a: unknown[]) => mockLimit(...a),
  });
  return query;
}

describe("selectCreditGrants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(makeQuery({ data: [], error: null }));
  });

  it("returns the account's grants, newest first", async () => {
    const rows = [
      {
        id: "grant-2",
        account_id: ACCOUNT,
        granted_by: "admin-1",
        reason: "Second top-up",
        previous_credits: 0,
        remaining_credits: 500,
        created_at: "2026-08-06T23:00:00.000Z",
      },
    ];
    mockFrom.mockReturnValue(makeQuery({ data: rows, error: null }));

    const result = await selectCreditGrants({ accountId: ACCOUNT });

    expect(mockFrom).toHaveBeenCalledWith("credit_grants");
    expect(mockEq).toHaveBeenCalledWith("account_id", ACCOUNT);
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual(rows);
  });

  it("breaks created_at ties on id, so the 500-row cap cannot return a shifting set", async () => {
    await selectCreditGrants({ accountId: ACCOUNT });

    // Two grants written in the same instant would otherwise order
    // non-deterministically, and near the cap that changes which rows come
    // back at all. Matches the sibling selectUsageEvents.
    expect(mockOrder).toHaveBeenCalledWith("id", { ascending: false });
  });

  it("filters on created_at when a cutoff is supplied", async () => {
    await selectCreditGrants({ accountId: ACCOUNT, createdAfter: "2026-07-06T00:00:00.000Z" });

    expect(mockGte).toHaveBeenCalledWith("created_at", "2026-07-06T00:00:00.000Z");
  });

  it("fetches all-time when no cutoff is supplied", async () => {
    await selectCreditGrants({ accountId: ACCOUNT });

    expect(mockGte).not.toHaveBeenCalled();
  });

  it("caps the result set at 500 rows, matching the documented contract", async () => {
    await selectCreditGrants({ accountId: ACCOUNT });

    expect(mockLimit).toHaveBeenCalledWith(500);
  });

  it("returns an empty array rather than null when the account has never been granted anything", async () => {
    mockFrom.mockReturnValue(makeQuery({ data: null, error: null }));

    const result = await selectCreditGrants({ accountId: ACCOUNT });

    expect(result).toEqual([]);
  });

  it("throws when the query fails", async () => {
    mockFrom.mockReturnValue(makeQuery({ data: null, error: { message: "boom" } }));

    await expect(selectCreditGrants({ accountId: ACCOUNT })).rejects.toBeTruthy();
  });
});

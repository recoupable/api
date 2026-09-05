import { describe, it, expect } from "vitest";
import { pickAutoTopUpRow } from "@/lib/billing/pickAutoTopUpRow";

describe("pickAutoTopUpRow", () => {
  it("keeps only the auto top-up columns and normalizes missing values", () => {
    expect(
      pickAutoTopUpRow({ account_id: "a", remaining_credits: 9, auto_topup_enabled: undefined }),
    ).toEqual({
      account_id: "a",
      auto_topup_enabled: false,
      auto_topup_amount: null,
      auto_topup_threshold: null,
      auto_topup_last_run_at: null,
      auto_topup_last_error: null,
    });
  });
});

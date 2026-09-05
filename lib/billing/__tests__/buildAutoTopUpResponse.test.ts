import { describe, it, expect } from "vitest";
import { buildAutoTopUpResponse } from "@/lib/billing/buildAutoTopUpResponse";

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("buildAutoTopUpResponse", () => {
  it("returns the documented defaults when the account has no row", () => {
    expect(buildAutoTopUpResponse({ accountId: ACCOUNT, row: null })).toEqual({
      account_id: ACCOUNT,
      enabled: false,
      amountCents: null,
      thresholdCents: null,
      lastRunAt: null,
      lastError: null,
    });
  });

  it("maps micro-dollar columns to cents and passes the audit fields through", () => {
    expect(
      buildAutoTopUpResponse({
        accountId: ACCOUNT,
        row: {
          account_id: ACCOUNT,
          auto_topup_enabled: true,
          auto_topup_amount: 100_000_000,
          auto_topup_threshold: 1_000_000,
          auto_topup_last_run_at: "2026-09-04T15:05:00+00:00",
          auto_topup_last_error: "Your card was declined.",
        },
      }),
    ).toEqual({
      account_id: ACCOUNT,
      enabled: true,
      amountCents: 10000,
      thresholdCents: 100,
      lastRunAt: "2026-09-04T15:05:00+00:00",
      lastError: "Your card was declined.",
    });
  });
});

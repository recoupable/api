import { describe, it, expect } from "vitest";
import { shouldStampCustomerMetadata } from "@/scripts/shouldStampCustomerMetadata";

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_ACCOUNT = "999e9999-e99b-99d9-a999-999999999999";

describe("shouldStampCustomerMetadata", () => {
  it("stamps when the Customer has no metadata.accountId yet", () => {
    expect(shouldStampCustomerMetadata(null, ACCOUNT)).toEqual({
      action: "stamp",
      reason: "missing",
    });
    expect(shouldStampCustomerMetadata(undefined, ACCOUNT)).toEqual({
      action: "stamp",
      reason: "missing",
    });
    expect(shouldStampCustomerMetadata({ otherField: "x" }, ACCOUNT)).toEqual({
      action: "stamp",
      reason: "missing",
    });
  });

  it("skips when the Customer's metadata.accountId already matches", () => {
    expect(shouldStampCustomerMetadata({ accountId: ACCOUNT }, ACCOUNT)).toEqual({
      action: "skip",
      reason: "already-stamped",
    });
  });

  it("skips with a conflict reason when metadata.accountId is a different value", () => {
    expect(shouldStampCustomerMetadata({ accountId: OTHER_ACCOUNT }, ACCOUNT)).toEqual({
      action: "skip",
      reason: "conflict",
    });
  });
});

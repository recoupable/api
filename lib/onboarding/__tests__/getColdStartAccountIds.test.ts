import { describe, it, expect } from "vitest";
import { getColdStartAccountIds } from "../getColdStartAccountIds";

describe("getColdStartAccountIds", () => {
  it("returns welcomed accounts that still have no artist", () => {
    const ids = getColdStartAccountIds({
      welcomedAccountIds: ["a", "b", "c"],
      rosteredAccountIds: ["b"],
      alreadyNudgedAccountIds: [],
    });

    expect(ids).toEqual(["a", "c"]);
  });

  it("never nudges the same account twice", () => {
    const ids = getColdStartAccountIds({
      welcomedAccountIds: ["a", "b"],
      rosteredAccountIds: [],
      alreadyNudgedAccountIds: ["a"],
    });

    expect(ids).toEqual(["b"]);
  });

  it("deduplicates a welcomed list that repeats an account", () => {
    // email_send_log can hold more than one sent row per account.
    const ids = getColdStartAccountIds({
      welcomedAccountIds: ["a", "a", "a"],
      rosteredAccountIds: [],
      alreadyNudgedAccountIds: [],
    });

    expect(ids).toEqual(["a"]);
  });

  it("returns nothing when every welcomed account is activated", () => {
    const ids = getColdStartAccountIds({
      welcomedAccountIds: ["a", "b"],
      rosteredAccountIds: ["a", "b"],
      alreadyNudgedAccountIds: [],
    });

    expect(ids).toEqual([]);
  });
});

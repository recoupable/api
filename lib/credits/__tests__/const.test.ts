import { describe, expect, it } from "vitest";

import { DEFAULT_CREDITS, PRO_CREDITS } from "@/lib/credits/const";

describe("credit plan constants", () => {
  it("keeps the free-tier allotment at 333 (matches chat/lib/consts.ts)", () => {
    expect(DEFAULT_CREDITS).toBe(333);
  });

  it("gives pro accounts 9999 credits per month (matches chat/lib/consts.ts)", () => {
    expect(PRO_CREDITS).toBe(9999);
  });
});

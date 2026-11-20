import { describe, it, expect, afterEach } from "vitest";
import { getTrustedBoardPrincipals } from "@/lib/board/getTrustedBoardPrincipals";

describe("getTrustedBoardPrincipals", () => {
  const original = process.env.BOARD_TRUSTED_PRINCIPALS;

  afterEach(() => {
    if (original === undefined) delete process.env.BOARD_TRUSTED_PRINCIPALS;
    else process.env.BOARD_TRUSTED_PRINCIPALS = original;
  });

  it("returns no principals when the variable is unset", () => {
    delete process.env.BOARD_TRUSTED_PRINCIPALS;
    expect(getTrustedBoardPrincipals()).toEqual([]);
  });

  it("splits, trims and drops empty entries", () => {
    process.env.BOARD_TRUSTED_PRINCIPALS = " vercel:user:abc , ,vercel:user:def ";
    expect(getTrustedBoardPrincipals()).toEqual(["vercel:user:abc", "vercel:user:def"]);
  });
});

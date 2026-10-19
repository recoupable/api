import { describe, it, expect } from "vitest";
import { POST_CREDITS } from "../postCredits";

describe("POST_CREDITS", () => {
  it("is $0.01 at the micro-dollar credit unit", () => {
    expect(POST_CREDITS).toBe(10_000);
  });
});

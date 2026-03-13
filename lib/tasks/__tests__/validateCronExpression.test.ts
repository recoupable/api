import { describe, it, expect } from "vitest";
import { isValidCronExpression } from "../validateCronExpression";

describe("isValidCronExpression", () => {
  describe("valid expressions", () => {
    it("accepts standard cron with all wildcards", () => {
      expect(isValidCronExpression("* * * * *")).toBe(true);
    });

    it("accepts specific values", () => {
      expect(isValidCronExpression("0 21 * * 0")).toBe(true);
    });

    it("accepts step values", () => {
      expect(isValidCronExpression("*/15 * * * *")).toBe(true);
    });

    it("accepts ranges", () => {
      expect(isValidCronExpression("0 9-17 * * 1-5")).toBe(true);
    });

    it("accepts comma-separated values", () => {
      expect(isValidCronExpression("0 0,12 * * *")).toBe(true);
    });

    it("accepts combined step and wildcard", () => {
      expect(isValidCronExpression("0 */6 * * *")).toBe(true);
    });
  });

  describe("invalid expressions", () => {
    it("rejects double asterisks", () => {
      expect(isValidCronExpression("0 21 ** ** 0")).toBe(false);
    });

    it("rejects expressions with fewer than 5 fields", () => {
      expect(isValidCronExpression("0 21 * *")).toBe(false);
    });

    it("rejects expressions with more than 5 fields", () => {
      expect(isValidCronExpression("0 21 * * 0 2024")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidCronExpression("")).toBe(false);
    });

    it("rejects expressions with letters", () => {
      expect(isValidCronExpression("0 21 * * MON")).toBe(false);
    });

    it("rejects expressions with special characters", () => {
      expect(isValidCronExpression("0 21 ? * 0")).toBe(false);
    });
  });
});

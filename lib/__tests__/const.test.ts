import { describe, it, expect } from "vitest";
import { ADMIN_EMAILS } from "@/lib/const";

describe("lib/const", () => {
  describe("ADMIN_EMAILS", () => {
    it("should export ADMIN_EMAILS as an array", () => {
      expect(Array.isArray(ADMIN_EMAILS)).toBe(true);
    });

    it("should contain at least one admin email", () => {
      expect(ADMIN_EMAILS.length).toBeGreaterThan(0);
    });

    it("should contain valid email strings", () => {
      for (const email of ADMIN_EMAILS) {
        expect(typeof email).toBe("string");
        expect(email).toMatch(/@/);
      }
    });
  });
});

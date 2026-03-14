import { describe, it, expect } from "vitest";
import { getFromWithName } from "../getFromWithName";

describe("getFromWithName", () => {
  describe("outbound domain conversion", () => {
    it("converts inbound @mail.recoupable.com to outbound @recoupable.com", () => {
      const result = getFromWithName(["support@mail.recoupable.com"]);

      expect(result).toBe("Support by Recoup <support@recoupable.com>");
    });

    it("preserves the email name when converting domains", () => {
      const result = getFromWithName(["agent@mail.recoupable.com"]);

      expect(result).toBe("Agent by Recoup <agent@recoupable.com>");
    });
  });

  describe("finding inbound email", () => {
    it("finds recoup email in to array", () => {
      const result = getFromWithName(["hello@mail.recoupable.com"]);

      expect(result).toBe("Hello by Recoup <hello@recoupable.com>");
    });

    it("finds recoup email among multiple to addresses", () => {
      const result = getFromWithName([
        "other@example.com",
        "support@mail.recoupable.com",
        "another@example.com",
      ]);

      expect(result).toBe("Support by Recoup <support@recoupable.com>");
    });

    it("falls back to cc array when not in to array", () => {
      const result = getFromWithName(["other@example.com"], ["support@mail.recoupable.com"]);

      expect(result).toBe("Support by Recoup <support@recoupable.com>");
    });

    it("prefers to array over cc array", () => {
      const result = getFromWithName(
        ["to-agent@mail.recoupable.com"],
        ["cc-agent@mail.recoupable.com"],
      );

      expect(result).toBe("To-agent by Recoup <to-agent@recoupable.com>");
    });

    it("handles case-insensitive domain matching", () => {
      const result = getFromWithName(["Support@MAIL.RECOUPABLE.COM"]);

      expect(result).toBe("Support by Recoup <Support@recoupable.com>");
    });
  });

  describe("error handling", () => {
    it("throws error when no recoup email found in to or cc", () => {
      expect(() => getFromWithName(["other@example.com"])).toThrow(
        "No email found ending with @mail.recoupable.com",
      );
    });

    it("throws error when arrays are empty", () => {
      expect(() => getFromWithName([])).toThrow("No email found ending with @mail.recoupable.com");
    });
  });

  describe("name formatting", () => {
    it("capitalizes first letter of name", () => {
      const result = getFromWithName(["lowercase@mail.recoupable.com"]);

      expect(result).toBe("Lowercase by Recoup <lowercase@recoupable.com>");
    });

    it("preserves rest of name casing", () => {
      const result = getFromWithName(["myAgent@mail.recoupable.com"]);

      expect(result).toBe("MyAgent by Recoup <myAgent@recoupable.com>");
    });
  });
});

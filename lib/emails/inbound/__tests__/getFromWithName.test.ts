import { describe, it, expect } from "vitest";
import { getFromWithName } from "../getFromWithName";

describe("getFromWithName", () => {
  describe("outbound domain conversion", () => {
    it("converts inbound @mail.recoupable.dev to outbound @recoupable.dev", () => {
      const result = getFromWithName(["support@mail.recoupable.dev"]);

      expect(result).toBe("Support by Recoup <support@recoupable.dev>");
    });

    it("preserves the email name when converting domains", () => {
      const result = getFromWithName(["agent@mail.recoupable.dev"]);

      expect(result).toBe("Agent by Recoup <agent@recoupable.dev>");
    });
  });

  describe("finding inbound email", () => {
    it("finds recoup email in to array", () => {
      const result = getFromWithName(["hello@mail.recoupable.dev"]);

      expect(result).toBe("Hello by Recoup <hello@recoupable.dev>");
    });

    it("finds recoup email among multiple to addresses", () => {
      const result = getFromWithName([
        "other@example.com",
        "support@mail.recoupable.dev",
        "another@example.com",
      ]);

      expect(result).toBe("Support by Recoup <support@recoupable.dev>");
    });

    it("falls back to cc array when not in to array", () => {
      const result = getFromWithName(["other@example.com"], ["support@mail.recoupable.dev"]);

      expect(result).toBe("Support by Recoup <support@recoupable.dev>");
    });

    it("prefers to array over cc array", () => {
      const result = getFromWithName(
        ["to-agent@mail.recoupable.dev"],
        ["cc-agent@mail.recoupable.dev"],
      );

      expect(result).toBe("To-agent by Recoup <to-agent@recoupable.dev>");
    });

    it("handles case-insensitive domain matching", () => {
      const result = getFromWithName(["Support@MAIL.RECOUPABLE.DEV"]);

      expect(result).toBe("Support by Recoup <Support@recoupable.dev>");
    });
  });

  describe("error handling", () => {
    it("throws error when no recoup email found in to or cc", () => {
      expect(() => getFromWithName(["other@example.com"])).toThrow(
        "No email found ending with @mail.recoupable.dev",
      );
    });

    it("throws error when arrays are empty", () => {
      expect(() => getFromWithName([])).toThrow("No email found ending with @mail.recoupable.dev");
    });
  });

  describe("name formatting", () => {
    it("capitalizes first letter of name", () => {
      const result = getFromWithName(["lowercase@mail.recoupable.dev"]);

      expect(result).toBe("Lowercase by Recoup <lowercase@recoupable.dev>");
    });

    it("preserves rest of name casing", () => {
      const result = getFromWithName(["myAgent@mail.recoupable.dev"]);

      expect(result).toBe("MyAgent by Recoup <myAgent@recoupable.dev>");
    });
  });
});

import { describe, it, expect } from "vitest";
import { normalizeOrgDomain } from "../normalizeOrgDomain";

describe("normalizeOrgDomain", () => {
  describe("normalization", () => {
    it("lowercases the domain", () => {
      expect(normalizeOrgDomain("SeekerMusic.COM")).toBe("seekermusic.com");
    });

    it("trims surrounding whitespace", () => {
      expect(normalizeOrgDomain("  seekermusic.com  ")).toBe("seekermusic.com");
    });

    it("strips a leading @", () => {
      expect(normalizeOrgDomain("@seekermusic.com")).toBe("seekermusic.com");
    });

    it("applies all normalizations together", () => {
      expect(normalizeOrgDomain(" @SeekerMusic.com ")).toBe("seekermusic.com");
    });

    it("keeps subdomains and hyphens", () => {
      expect(normalizeOrgDomain("mail.seeker-music.co.uk")).toBe("mail.seeker-music.co.uk");
    });
  });

  describe("rejection", () => {
    it("rejects a domain without a dot", () => {
      expect(normalizeOrgDomain("seekermusic")).toBeNull();
    });

    it("rejects strings with spaces", () => {
      expect(normalizeOrgDomain("seeker music.com")).toBeNull();
    });

    it("rejects strings with slashes", () => {
      expect(normalizeOrgDomain("seekermusic.com/path")).toBeNull();
    });

    it("rejects full email addresses", () => {
      expect(normalizeOrgDomain("sam@seekermusic.com")).toBeNull();
    });

    it("rejects empty string", () => {
      expect(normalizeOrgDomain("")).toBeNull();
    });

    it("rejects a bare @", () => {
      expect(normalizeOrgDomain("@")).toBeNull();
    });

    it("rejects leading or trailing dots", () => {
      expect(normalizeOrgDomain(".seekermusic.com")).toBeNull();
      expect(normalizeOrgDomain("seekermusic.com.")).toBeNull();
    });
  });
});

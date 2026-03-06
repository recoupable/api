import { describe, it, expect } from "vitest";
import { getUsernameFromProfileUrl } from "../getUsernameFromProfileUrl";

describe("getUsernameFromProfileUrl", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(getUsernameFromProfileUrl(null)).toBe("");
    expect(getUsernameFromProfileUrl(undefined)).toBe("");
    expect(getUsernameFromProfileUrl("")).toBe("");
  });

  it("extracts username from standard profile URLs", () => {
    expect(getUsernameFromProfileUrl("https://instagram.com/theweeknd")).toBe("theweeknd");
    expect(getUsernameFromProfileUrl("https://twitter.com/elonmusk")).toBe("elonmusk");
    expect(getUsernameFromProfileUrl("https://www.tiktok.com/drake")).toBe("drake");
    expect(getUsernameFromProfileUrl("https://threads.net/zuck")).toBe("zuck");
  });

  it("preserves original casing of usernames", () => {
    expect(getUsernameFromProfileUrl("https://tiktok.com/TheWeeknd")).toBe("TheWeeknd");
    expect(getUsernameFromProfileUrl("https://youtube.com/MrBeast")).toBe("MrBeast");
  });

  it("strips leading @ from usernames", () => {
    expect(getUsernameFromProfileUrl("https://instagram.com/@theweeknd")).toBe("theweeknd");
    expect(getUsernameFromProfileUrl("https://threads.net/@zuck")).toBe("zuck");
  });

  it("strips query parameters and trailing paths", () => {
    expect(getUsernameFromProfileUrl("https://instagram.com/theweeknd?hl=en")).toBe("theweeknd");
    expect(getUsernameFromProfileUrl("https://twitter.com/elonmusk/status/123")).toBe("elonmusk");
  });

  it("returns empty string for URLs without a path segment", () => {
    expect(getUsernameFromProfileUrl("https://instagram.com/")).toBe("");
    expect(getUsernameFromProfileUrl("https://instagram.com")).toBe("");
  });

  it("returns empty string for unsupported URL formats", () => {
    expect(getUsernameFromProfileUrl("not-a-url")).toBe("");
  });
});

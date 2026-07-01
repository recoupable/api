import { describe, it, expect } from "vitest";
import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";

describe("getSocialPlatformByLink", () => {
  it("maps linkedin.com to LINKEDIN", () => {
    expect(getSocialPlatformByLink("https://linkedin.com/in/drew-thurlow")).toBe("LINKEDIN");
    expect(getSocialPlatformByLink("linkedin.com/company/recoup")).toBe("LINKEDIN");
  });
  it("still maps the existing platforms", () => {
    expect(getSocialPlatformByLink("x.com/theasf")).toBe("TWITTER");
    expect(getSocialPlatformByLink("tiktok.com/@apache_207")).toBe("TIKTOK");
    expect(getSocialPlatformByLink("")).toBe("NONE");
  });
});

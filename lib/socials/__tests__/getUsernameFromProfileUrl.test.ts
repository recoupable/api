import { describe, it, expect } from "vitest";
import { getUsernameFromProfileUrl } from "@/lib/socials/getUsernameFromProfileUrl";

describe("getUsernameFromProfileUrl", () => {
  it("extracts the first path segment for standard platforms", () => {
    expect(getUsernameFromProfileUrl("https://instagram.com/apacheoficial")).toBe("apacheoficial");
    expect(getUsernameFromProfileUrl("x.com/theasf")).toBe("theasf");
    expect(getUsernameFromProfileUrl("")).toBe("");
  });

  it("extracts the handle from LinkedIn /in/, /company/, /school/ URLs (not the path prefix)", () => {
    expect(getUsernameFromProfileUrl("https://www.linkedin.com/in/sweetmaneth/")).toBe(
      "sweetmaneth",
    );
    expect(getUsernameFromProfileUrl("linkedin.com/in/drew-thurlow-3a354311")).toBe(
      "drew-thurlow-3a354311",
    );
    expect(getUsernameFromProfileUrl("https://linkedin.com/company/recoupable")).toBe("recoupable");
  });
});

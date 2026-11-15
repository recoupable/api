import { describe, it, expect } from "vitest";
import { getLinkedinCompanyUrl } from "@/lib/apify/linkedin/getLinkedinCompanyUrl";

describe("getLinkedinCompanyUrl", () => {
  it.each([
    "linkedin.com/company/recoupable",
    "https://www.linkedin.com/company/recoupable",
    "https://www.linkedin.com/company/recoupable/",
    "https://www.linkedin.com/company/recoupable/posts/?feedView=all",
    "www.LinkedIn.com/company/recoupable?trk=x",
  ])("returns the canonical company page URL for %s", input => {
    expect(getLinkedinCompanyUrl(input)).toBe("https://www.linkedin.com/company/recoupable");
  });

  it.each([
    "linkedin.com/in/sweetmaneth",
    "https://www.linkedin.com/in/sweetmaneth?miniProfileUrn=x",
    "sweetmaneth",
    "company",
    "https://x.com/company/recoupable",
    "",
    null,
    undefined,
  ])("returns null for a non-company input: %s", input => {
    expect(getLinkedinCompanyUrl(input)).toBeNull();
  });
});

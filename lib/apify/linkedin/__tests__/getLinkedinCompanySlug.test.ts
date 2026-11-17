import { describe, it, expect } from "vitest";
import { getLinkedinCompanySlug } from "@/lib/apify/linkedin/getLinkedinCompanySlug";

describe("getLinkedinCompanySlug", () => {
  it.each([
    ["linkedin.com/company/recoupable", "recoupable"],
    ["http://www.linkedin.com/company/Recoupable/posts?x=1", "recoupable"],
    ["https://LinkedIn.com/company/recoup-able#about", "recoup-able"],
    ["  linkedin.com/company/recoupable \n", "recoupable"],
  ])("returns the lower-case slug of %s", (input, slug) => {
    expect(getLinkedinCompanySlug(input)).toBe(slug);
  });

  it.each([
    "linkedin.com/in/sweetmantech",
    "recoupable",
    "https://x.com/company/recoupable",
    "",
    null,
    undefined,
  ])("returns null for a non-company input: %s", input => {
    expect(getLinkedinCompanySlug(input)).toBeNull();
  });
});

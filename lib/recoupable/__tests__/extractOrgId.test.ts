import { describe, it, expect } from "vitest";
import { extractOrgId } from "@/lib/recoupable/extractOrgId";

describe("extractOrgId", () => {
  it("extracts the UUID tail from a full clone URL", () => {
    expect(
      extractOrgId(
        "https://github.com/recoupable/org-rostrum-pacific-cebcc866-34c3-451c-8cd7-f63309acff0a",
      ),
    ).toBe("cebcc866-34c3-451c-8cd7-f63309acff0a");
  });

  it("strips a .git suffix before extracting", () => {
    expect(
      extractOrgId(
        "https://github.com/recoupable/org-myco-wtf-80263819-9dfd-4bbf-9371-60a6185122d6.git",
      ),
    ).toBe("80263819-9dfd-4bbf-9371-60a6185122d6");
  });

  it("tolerates a trailing slash on the URL", () => {
    expect(
      extractOrgId(
        "https://github.com/recoupable/org-myco-wtf-80263819-9dfd-4bbf-9371-60a6185122d6/",
      ),
    ).toBe("80263819-9dfd-4bbf-9371-60a6185122d6");
  });

  it("accepts an already-extracted repo name", () => {
    expect(extractOrgId("org-rostrum-pacific-cebcc866-34c3-451c-8cd7-f63309acff0a")).toBe(
      "cebcc866-34c3-451c-8cd7-f63309acff0a",
    );
  });

  it("lowercases an uppercase UUID", () => {
    expect(extractOrgId("org-myco-wtf-80263819-9DFD-4BBF-9371-60A6185122D6")).toBe(
      "80263819-9dfd-4bbf-9371-60a6185122d6",
    );
  });

  it("returns null for non-Recoupable clone URLs", () => {
    expect(
      extractOrgId(
        "https://github.com/someone-else/org-myco-wtf-80263819-9dfd-4bbf-9371-60a6185122d6",
      ),
    ).toBeNull();
  });

  it("returns null when the repo name has no UUID tail", () => {
    expect(extractOrgId("org-rostrum-pacific")).toBeNull();
  });

  it("returns null for malformed strings", () => {
    expect(extractOrgId("")).toBeNull();
    expect(extractOrgId("not-a-url-or-repo")).toBeNull();
  });
});

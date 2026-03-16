import { describe, it, expect } from "vitest";
import { parseLinkHeaderLastPage } from "../parseLinkHeaderLastPage";

describe("parseLinkHeaderLastPage", () => {
  it("returns 1 when linkHeader is null", () => {
    expect(parseLinkHeaderLastPage(null)).toBe(1);
  });

  it("returns 1 when no last relation found", () => {
    expect(parseLinkHeaderLastPage('<https://api.github.com/repos?page=2>; rel="next"')).toBe(1);
  });

  it("extracts last page number from Link header", () => {
    const header =
      '<https://api.github.com/repos?per_page=1&page=2>; rel="next", <https://api.github.com/repos?per_page=1&page=42>; rel="last"';
    expect(parseLinkHeaderLastPage(header)).toBe(42);
  });
});

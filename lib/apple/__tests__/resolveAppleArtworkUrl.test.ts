import { describe, it, expect } from "vitest";
import { resolveAppleArtworkUrl } from "@/lib/apple/resolveAppleArtworkUrl";

describe("resolveAppleArtworkUrl", () => {
  it("substitutes {w}x{h} with the default square size", () => {
    expect(
      resolveAppleArtworkUrl("https://is1-ssl.mzstatic.com/image/thumb/a/0.jpg/{w}x{h}bb.jpg"),
    ).toBe("https://is1-ssl.mzstatic.com/image/thumb/a/0.jpg/296x296bb.jpg");
  });

  it("substitutes a caller-provided size", () => {
    expect(resolveAppleArtworkUrl("https://a/0.jpg/{w}x{h}bb.jpg", 600)).toBe(
      "https://a/0.jpg/600x600bb.jpg",
    );
  });

  it("returns a URL without placeholders unchanged", () => {
    expect(resolveAppleArtworkUrl("https://a/0.jpg/296x296bb.jpg")).toBe(
      "https://a/0.jpg/296x296bb.jpg",
    );
  });
});

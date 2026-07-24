import { describe, it, expect } from "vitest";
import { renderEmailLayout } from "@/lib/emails/renderEmailLayout";

describe("renderEmailLayout", () => {
  it("wraps the body HTML inside the layout", () => {
    const html = renderEmailLayout({ bodyHtml: "<p>Hello world</p>" });
    expect(html).toContain("<p>Hello world</p>");
  });

  it("includes the footer HTML when provided", () => {
    const html = renderEmailLayout({
      bodyHtml: "<p>Body</p>",
      footerHtml: "<div>Footer bits</div>",
    });
    expect(html).toContain("<div>Footer bits</div>");
  });

  it("omits the footer region when no footer is provided", () => {
    const html = renderEmailLayout({ bodyHtml: "<p>Body</p>" });
    expect(html).not.toContain("Footer bits");
  });

  it("renders a CTA button with the given label and url when provided", () => {
    const html = renderEmailLayout({
      bodyHtml: "<p>Body</p>",
      cta: { label: "Open Recoup", url: "https://chat.recoupable.dev" },
    });
    expect(html).toContain("Open Recoup");
    expect(html).toContain('href="https://chat.recoupable.dev"');
  });

  it("does not render a CTA when none is provided", () => {
    const html = renderEmailLayout({ bodyHtml: "<p>Body</p>" });
    expect(html).not.toContain("<a ");
  });

  it("carries the Recoup house style — wordmark, font stack, and shadow-as-border card", () => {
    const html = renderEmailLayout({ bodyHtml: "<p>Body</p>" });
    // Header wordmark.
    expect(html).toContain("Recoup");
    // Achromatic near-black brand ink (DESIGN.md --foreground).
    expect(html).toContain("#0a0a0a");
    // Shadow-as-border card outline (DESIGN.md), not a CSS `border` on the card.
    expect(html).toContain("box-shadow");
    // Brand font stack (Plus Jakarta Sans for UI, per DESIGN.md).
    expect(html).toContain("Plus Jakarta Sans");
    // Constrained, centered container.
    expect(html).toContain("max-width");
  });

  it("never breaks a style attribute with quotes in the font stack", () => {
    const html = renderEmailLayout({ bodyHtml: "<p>Body</p>" });

    // Regression: double-quoted font names inside a double-quoted style="…"
    // attribute terminate it early, silently dropping the font (clients fall
    // back to serif) and every declaration after it. Font names must be
    // single-quoted so the attribute stays intact.
    expect(html).not.toContain('"Plus Jakarta Sans"');
    expect(html).toContain("'Plus Jakarta Sans'");
    // No style attribute may contain a stray double quote before its close.
    for (const style of html.match(/style="[^"]*"/g) ?? []) {
      expect(style).not.toContain("font-family:\"");
    }
  });

  it("returns a single HTML string", () => {
    expect(typeof renderEmailLayout({ bodyHtml: "<p>x</p>" })).toBe("string");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetFrontendBaseUrl = vi.fn();
vi.mock("@/lib/composio/getFrontendBaseUrl", () => ({
  getFrontendBaseUrl: (...args: unknown[]) => mockGetFrontendBaseUrl(...args),
}));

const mockGetEmailFooter = vi.fn();
vi.mock("@/lib/emails/getEmailFooter", () => ({
  getEmailFooter: (...args: unknown[]) => mockGetEmailFooter(...args),
}));

const { buildWelcomeEmail } = await import("../buildWelcomeEmail");

describe("buildWelcomeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFrontendBaseUrl.mockReturnValue("https://chat.example.com");
    mockGetEmailFooter.mockReturnValue("<footer>reply note</footer>");
  });

  it("returns the welcome subject", () => {
    const { subject } = buildWelcomeEmail();

    expect(subject).toBe("Welcome to Recoup");
  });

  it("links the one next step to the chat app", () => {
    const { html } = buildWelcomeEmail();

    expect(html).toContain('href="https://chat.example.com"');
    expect(html.toLowerCase()).toContain("valuation");
  });

  it("appends the standard email footer without a room link", () => {
    const { html } = buildWelcomeEmail();

    expect(mockGetEmailFooter).toHaveBeenCalledWith();
    expect(html).toContain("<footer>reply note</footer>");
  });

  it("contains no em or en dashes in outward-facing copy", () => {
    const { subject, html } = buildWelcomeEmail();

    expect(subject).not.toMatch(/[–—]/);
    expect(html).not.toMatch(/[–—]/);
  });

  it("walks the five onboarding steps in order", () => {
    const { html } = buildWelcomeEmail();

    const order = [
      "1. Confirm your artists",
      "2. Verify their socials",
      "3. Claim your catalog",
      "4. See your baseline valuation",
      "5. Automate with tasks",
    ];
    let cursor = -1;
    for (const label of order) {
      const at = html.indexOf(label);
      expect(at, `"${label}" present`).toBeGreaterThan(-1);
      expect(at, `"${label}" after the previous step`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("features the full cast with stable Spotify art (no expiring social CDNs)", () => {
    const { html } = buildWelcomeEmail();

    for (const name of [
      "Gatsby Grace",
      "LA EQUIS",
      "Sound of Fractures",
      "Brauxelion",
      "LATASHA",
    ]) {
      expect(html).toContain(name);
    }
    // At least the 5 PFPs + the album covers used in the steps.
    const imageCount = (html.match(/i\.scdn\.co/g) ?? []).length;
    expect(imageCount).toBeGreaterThanOrEqual(8);
    expect(html).not.toContain("cdninstagram.com");
    expect(html).not.toContain("tiktokcdn");
  });
});

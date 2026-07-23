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

  it("points the primary CTA at the setup flow", () => {
    const { html } = buildWelcomeEmail();

    expect(html).toContain('href="https://chat.example.com/setup"');
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

  it("links each step into its /setup route", () => {
    const { html } = buildWelcomeEmail();

    for (const path of [
      "/setup/artists",
      "/setup/socials",
      "/setup/catalog",
      "/setup/valuation",
      "/setup/tasks",
    ]) {
      expect(html).toContain(`href="https://chat.example.com${path}"`);
    }
  });

  it("uses only durable image hosts (no expiring social CDNs)", () => {
    const { html } = buildWelcomeEmail();

    // Album covers on Spotify CDN + the pre-composed step 1/2 art on Vercel Blob.
    expect(html).toContain("i.scdn.co");
    expect(html).toContain("blob.vercel-storage.com");
    expect(html).not.toContain("cdninstagram.com");
    expect(html).not.toContain("tiktokcdn");
  });
});

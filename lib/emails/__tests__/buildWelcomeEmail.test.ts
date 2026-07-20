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
});

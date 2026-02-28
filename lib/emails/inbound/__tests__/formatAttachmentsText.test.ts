import { describe, it, expect } from "vitest";
import { formatAttachmentsText } from "../formatAttachmentsText";
import type { EmailAttachment } from "../getEmailAttachments";

const makeAttachment = (overrides: Partial<EmailAttachment> = {}): EmailAttachment =>
  ({
    id: "att-1",
    filename: "file.txt",
    size: 1024,
    content_type: "text/plain",
    content_disposition: "attachment",
    download_url: "https://resend.com/dl/att-1",
    expires_at: "2025-01-01T01:00:00Z",
    ...overrides,
  }) as EmailAttachment;

describe("formatAttachmentsText", () => {
  it("returns empty string for empty array", () => {
    expect(formatAttachmentsText([])).toBe("");
  });

  it("formats a single attachment", () => {
    const attachments = [
      makeAttachment({
        filename: "logo.svg",
        content_type: "image/svg+xml",
        download_url: "https://resend.com/dl/att-1",
      }),
    ];

    const result = formatAttachmentsText(attachments);

    expect(result).toBe(
      "\n\nAttached files:\n- logo.svg (image/svg+xml): https://resend.com/dl/att-1",
    );
  });

  it("formats multiple attachments", () => {
    const attachments = [
      makeAttachment({
        filename: "logo.svg",
        content_type: "image/svg+xml",
        download_url: "https://resend.com/dl/att-1",
      }),
      makeAttachment({
        id: "att-2",
        filename: "report.pdf",
        content_type: "application/pdf",
        download_url: "https://resend.com/dl/att-2",
      }),
    ];

    const result = formatAttachmentsText(attachments);

    expect(result).toContain("Attached files:");
    expect(result).toContain("- logo.svg (image/svg+xml): https://resend.com/dl/att-1");
    expect(result).toContain("- report.pdf (application/pdf): https://resend.com/dl/att-2");
  });

  it("defaults filename to 'attachment' when not provided", () => {
    const attachments = [makeAttachment({ filename: undefined })];

    const result = formatAttachmentsText(attachments);

    expect(result).toContain("- attachment (text/plain):");
  });
});

import { describe, it, expect } from "vitest";
import { formatAttachmentsText } from "../formatAttachmentsText";
import type { EmailAttachment } from "../getEmailAttachments";

describe("formatAttachmentsText", () => {
  it("returns empty string for empty array", () => {
    expect(formatAttachmentsText([])).toBe("");
  });

  it("formats a single attachment", () => {
    const attachments: EmailAttachment[] = [
      {
        id: "att-1",
        filename: "logo.svg",
        contentType: "image/svg+xml",
        downloadUrl: "https://resend.com/dl/att-1",
      },
    ];

    const result = formatAttachmentsText(attachments);

    expect(result).toBe(
      "\n\nAttached files:\n- logo.svg (image/svg+xml): https://resend.com/dl/att-1",
    );
  });

  it("formats multiple attachments", () => {
    const attachments: EmailAttachment[] = [
      {
        id: "att-1",
        filename: "logo.svg",
        contentType: "image/svg+xml",
        downloadUrl: "https://resend.com/dl/att-1",
      },
      {
        id: "att-2",
        filename: "report.pdf",
        contentType: "application/pdf",
        downloadUrl: "https://resend.com/dl/att-2",
      },
    ];

    const result = formatAttachmentsText(attachments);

    expect(result).toContain("Attached files:");
    expect(result).toContain("- logo.svg (image/svg+xml): https://resend.com/dl/att-1");
    expect(result).toContain("- report.pdf (application/pdf): https://resend.com/dl/att-2");
  });
});

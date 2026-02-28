import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEmailAttachments } from "../getEmailAttachments";

import { getResendClient } from "@/lib/emails/client";

vi.mock("@/lib/emails/client", () => ({
  getResendClient: vi.fn(),
}));

const mockList = vi.fn();

describe("getEmailAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getResendClient).mockReturnValue({
      emails: {
        receiving: {
          attachments: {
            list: mockList,
          },
        },
      },
    } as ReturnType<typeof getResendClient>);
  });

  it("returns attachments directly from Resend SDK", async () => {
    mockList.mockResolvedValue({
      data: {
        data: [
          {
            id: "att-1",
            filename: "logo.svg",
            content_type: "image/svg+xml",
            download_url: "https://resend.com/dl/att-1",
            size: 1024,
            content_disposition: "attachment",
            expires_at: "2025-01-01T01:00:00Z",
          },
          {
            id: "att-2",
            filename: "report.pdf",
            content_type: "application/pdf",
            download_url: "https://resend.com/dl/att-2",
            size: 2048,
            content_disposition: "attachment",
            expires_at: "2025-01-01T01:00:00Z",
          },
        ],
      },
    });

    const result = await getEmailAttachments("email-123");

    expect(mockList).toHaveBeenCalledWith({ emailId: "email-123" });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("att-1");
    expect(result[0].download_url).toBe("https://resend.com/dl/att-1");
    expect(result[1].content_type).toBe("application/pdf");
  });

  it("returns empty array when no attachments exist", async () => {
    mockList.mockResolvedValue({ data: { data: [] } });

    const result = await getEmailAttachments("email-123");

    expect(result).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    mockList.mockResolvedValue({ data: null });

    const result = await getEmailAttachments("email-123");

    expect(result).toEqual([]);
  });
});

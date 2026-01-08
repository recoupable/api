import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEmailRoomId } from "../getEmailRoomId";
import type { GetReceivingEmailResponseSuccess } from "resend";

import selectMemoryEmails from "@/lib/supabase/memory_emails/selectMemoryEmails";

vi.mock("@/lib/supabase/memory_emails/selectMemoryEmails", () => ({
  default: vi.fn(),
}));

const mockSelectMemoryEmails = vi.mocked(selectMemoryEmails);

describe("getEmailRoomId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("primary: extracting from email text", () => {
    it("returns roomId when chat link found in email text", async () => {
      const emailContent = {
        text: "Check out this chat: https://chat.recoupable.com/chat/550e8400-e29b-41d4-a716-446655440000",
        headers: { references: "<old-message-id@example.com>" },
      } as GetReceivingEmailResponseSuccess;

      const result = await getEmailRoomId(emailContent);

      expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(mockSelectMemoryEmails).not.toHaveBeenCalled();
    });

    it("prioritizes chat link over references header", async () => {
      mockSelectMemoryEmails.mockResolvedValue([
        { memories: { room_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" } },
      ] as Awaited<ReturnType<typeof selectMemoryEmails>>);

      const emailContent = {
        text: "Link: https://chat.recoupable.com/chat/11111111-2222-3333-4444-555555555555",
        headers: { references: "<message-id@example.com>" },
      } as GetReceivingEmailResponseSuccess;

      const result = await getEmailRoomId(emailContent);

      expect(result).toBe("11111111-2222-3333-4444-555555555555");
      expect(mockSelectMemoryEmails).not.toHaveBeenCalled();
    });
  });

  describe("fallback: checking references header", () => {
    it("falls back to references header when no chat link in text", async () => {
      mockSelectMemoryEmails.mockResolvedValue([
        { memories: { room_id: "22222222-3333-4444-5555-666666666666" } },
      ] as Awaited<ReturnType<typeof selectMemoryEmails>>);

      const emailContent = {
        text: "No chat link here",
        headers: { references: "<message-id@example.com>" },
      } as GetReceivingEmailResponseSuccess;

      const result = await getEmailRoomId(emailContent);

      expect(result).toBe("22222222-3333-4444-5555-666666666666");
      expect(mockSelectMemoryEmails).toHaveBeenCalledWith({
        messageIds: ["<message-id@example.com>"],
      });
    });

    it("parses space-separated references header", async () => {
      mockSelectMemoryEmails.mockResolvedValue([
        { memories: { room_id: "33333333-4444-5555-6666-777777777777" } },
      ] as Awaited<ReturnType<typeof selectMemoryEmails>>);

      const emailContent = {
        text: undefined,
        headers: {
          references: "<first@example.com> <second@example.com> <third@example.com>",
        },
      } as GetReceivingEmailResponseSuccess;

      const result = await getEmailRoomId(emailContent);

      expect(mockSelectMemoryEmails).toHaveBeenCalledWith({
        messageIds: ["<first@example.com>", "<second@example.com>", "<third@example.com>"],
      });
      expect(result).toBe("33333333-4444-5555-6666-777777777777");
    });

    it("parses newline-separated references header", async () => {
      mockSelectMemoryEmails.mockResolvedValue([
        { memories: { room_id: "44444444-5555-6666-7777-888888888888" } },
      ] as Awaited<ReturnType<typeof selectMemoryEmails>>);

      const emailContent = {
        text: "",
        headers: {
          references: "<first@example.com>\n<second@example.com>",
        },
      } as GetReceivingEmailResponseSuccess;

      const result = await getEmailRoomId(emailContent);

      expect(mockSelectMemoryEmails).toHaveBeenCalledWith({
        messageIds: ["<first@example.com>", "<second@example.com>"],
      });
      expect(result).toBe("44444444-5555-6666-7777-888888888888");
    });
  });

  describe("returning undefined", () => {
    it("returns undefined when no chat link and no references header", async () => {
      const emailContent = {
        text: "No chat link here",
        headers: {},
      } as GetReceivingEmailResponseSuccess;

      const result = await getEmailRoomId(emailContent);

      expect(result).toBeUndefined();
      expect(mockSelectMemoryEmails).not.toHaveBeenCalled();
    });

    it("returns undefined when references header is empty", async () => {
      const emailContent = {
        text: "No chat link",
        headers: { references: "" },
      } as GetReceivingEmailResponseSuccess;

      const result = await getEmailRoomId(emailContent);

      expect(result).toBeUndefined();
    });

    it("returns undefined when no memory_emails found for references", async () => {
      mockSelectMemoryEmails.mockResolvedValue([]);

      const emailContent = {
        text: "No link",
        headers: { references: "<unknown@example.com>" },
      } as GetReceivingEmailResponseSuccess;

      const result = await getEmailRoomId(emailContent);

      expect(result).toBeUndefined();
    });

    it("returns undefined when memory_email has no associated memory", async () => {
      mockSelectMemoryEmails.mockResolvedValue([{ memories: null }] as unknown as Awaited<
        ReturnType<typeof selectMemoryEmails>
      >);

      const emailContent = {
        text: "No link",
        headers: { references: "<orphan@example.com>" },
      } as GetReceivingEmailResponseSuccess;

      const result = await getEmailRoomId(emailContent);

      expect(result).toBeUndefined();
    });
  });
});

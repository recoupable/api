import { describe, it, expect } from "vitest";
import { extractRoomIdFromText } from "../extractRoomIdFromText";

describe("extractRoomIdFromText", () => {
  describe("valid chat links", () => {
    it("extracts roomId from a valid Recoup chat link", () => {
      const text =
        "Check out this chat: https://chat.recoupable.com/chat/550e8400-e29b-41d4-a716-446655440000";

      const result = extractRoomIdFromText(text);

      expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("extracts roomId from chat link embedded in longer text", () => {
      const text = `
        Hey there,

        I wanted to follow up on our conversation.
        Here's the link: https://chat.recoupable.com/chat/a1b2c3d4-e5f6-7890-abcd-ef1234567890

        Let me know if you have questions.
      `;

      const result = extractRoomIdFromText(text);

      expect(result).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    });

    it("handles case-insensitive domain matching", () => {
      const text = "Visit HTTPS://CHAT.RECOUPABLE.COM/CHAT/12345678-1234-1234-1234-123456789abc";

      const result = extractRoomIdFromText(text);

      expect(result).toBe("12345678-1234-1234-1234-123456789abc");
    });

    it("extracts first roomId when multiple links present", () => {
      const text = `
        First link: https://chat.recoupable.com/chat/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
        Second link: https://chat.recoupable.com/chat/11111111-2222-3333-4444-555555555555
      `;

      const result = extractRoomIdFromText(text);

      expect(result).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    });
  });

  describe("invalid inputs", () => {
    it("returns undefined for undefined input", () => {
      const result = extractRoomIdFromText(undefined);

      expect(result).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      const result = extractRoomIdFromText("");

      expect(result).toBeUndefined();
    });

    it("returns undefined when no chat link present", () => {
      const text = "This email has no Recoup chat link.";

      const result = extractRoomIdFromText(text);

      expect(result).toBeUndefined();
    });

    it("returns undefined for invalid UUID format in link", () => {
      const text = "https://chat.recoupable.com/chat/not-a-valid-uuid";

      const result = extractRoomIdFromText(text);

      expect(result).toBeUndefined();
    });

    it("returns undefined for partial UUID", () => {
      const text = "https://chat.recoupable.com/chat/550e8400-e29b-41d4";

      const result = extractRoomIdFromText(text);

      expect(result).toBeUndefined();
    });

    it("returns undefined for wrong domain", () => {
      const text = "https://chat.otherdomain.com/chat/550e8400-e29b-41d4-a716-446655440000";

      const result = extractRoomIdFromText(text);

      expect(result).toBeUndefined();
    });

    it("returns undefined for wrong path structure", () => {
      const text = "https://chat.recoupable.com/room/550e8400-e29b-41d4-a716-446655440000";

      const result = extractRoomIdFromText(text);

      expect(result).toBeUndefined();
    });
  });
});

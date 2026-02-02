import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateCreateChatBody, createChatBodySchema } from "../validateCreateChatBody";

describe("validateCreateChatBody", () => {
  describe("artistId validation", () => {
    it("accepts valid UUID for artistId", () => {
      const result = validateCreateChatBody({
        artistId: "123e4567-e89b-12d3-a456-426614174000",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).artistId).toBe("123e4567-e89b-12d3-a456-426614174000");
    });

    it("rejects invalid UUID for artistId", () => {
      const result = validateCreateChatBody({
        artistId: "invalid-uuid",
      });

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("accepts missing artistId (optional)", () => {
      const result = validateCreateChatBody({});

      expect(result).not.toBeInstanceOf(NextResponse);
    });
  });

  describe("chatId validation", () => {
    it("accepts valid UUID for chatId", () => {
      const result = validateCreateChatBody({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).chatId).toBe("123e4567-e89b-12d3-a456-426614174000");
    });

    it("rejects invalid UUID for chatId", () => {
      const result = validateCreateChatBody({
        chatId: "invalid-uuid",
      });

      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe("accountId validation", () => {
    it("accepts valid UUID for accountId", () => {
      const result = validateCreateChatBody({
        accountId: "123e4567-e89b-12d3-a456-426614174000",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("123e4567-e89b-12d3-a456-426614174000");
    });

    it("rejects invalid UUID for accountId", () => {
      const result = validateCreateChatBody({
        accountId: "invalid-uuid",
      });

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("accepts missing accountId (optional)", () => {
      const result = validateCreateChatBody({
        artistId: "123e4567-e89b-12d3-a456-426614174000",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBeUndefined();
    });
  });

  describe("schema type inference", () => {
    it("schema should include accountId as optional UUID field", () => {
      const validBody = {
        artistId: "123e4567-e89b-12d3-a456-426614174000",
        chatId: "123e4567-e89b-12d3-a456-426614174001",
        accountId: "123e4567-e89b-12d3-a456-426614174002",
      };

      const result = createChatBodySchema.safeParse(validBody);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountId).toBe("123e4567-e89b-12d3-a456-426614174002");
      }
    });
  });

  describe("firstMessage validation", () => {
    it("accepts valid string for firstMessage", () => {
      const result = validateCreateChatBody({
        artistId: "123e4567-e89b-12d3-a456-426614174000",
        firstMessage: "What marketing strategies should I use?",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).firstMessage).toBe("What marketing strategies should I use?");
    });

    it("accepts missing firstMessage (optional)", () => {
      const result = validateCreateChatBody({
        artistId: "123e4567-e89b-12d3-a456-426614174000",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).firstMessage).toBeUndefined();
    });

    it("accepts empty string for firstMessage", () => {
      const result = validateCreateChatBody({
        artistId: "123e4567-e89b-12d3-a456-426614174000",
        firstMessage: "",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).firstMessage).toBe("");
    });
  });
});

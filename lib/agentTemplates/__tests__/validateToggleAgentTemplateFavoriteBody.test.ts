import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import {
  validateToggleAgentTemplateFavoriteBody,
  toggleAgentTemplateFavoriteBodySchema,
} from "../validateToggleAgentTemplateFavoriteBody";

describe("validateToggleAgentTemplateFavoriteBody", () => {
  describe("templateId validation", () => {
    it("accepts valid templateId string", () => {
      const result = validateToggleAgentTemplateFavoriteBody({
        templateId: "template-123",
        isFavourite: true,
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).templateId).toBe("template-123");
    });

    it("rejects missing templateId", () => {
      const result = validateToggleAgentTemplateFavoriteBody({
        isFavourite: true,
      });

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("rejects empty templateId", () => {
      const result = validateToggleAgentTemplateFavoriteBody({
        templateId: "",
        isFavourite: true,
      });

      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe("isFavourite validation", () => {
    it("accepts isFavourite as true", () => {
      const result = validateToggleAgentTemplateFavoriteBody({
        templateId: "template-123",
        isFavourite: true,
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).isFavourite).toBe(true);
    });

    it("accepts isFavourite as false", () => {
      const result = validateToggleAgentTemplateFavoriteBody({
        templateId: "template-123",
        isFavourite: false,
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).isFavourite).toBe(false);
    });

    it("rejects missing isFavourite", () => {
      const result = validateToggleAgentTemplateFavoriteBody({
        templateId: "template-123",
      });

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("rejects non-boolean isFavourite", () => {
      const result = validateToggleAgentTemplateFavoriteBody({
        templateId: "template-123",
        isFavourite: "true",
      });

      expect(result).toBeInstanceOf(NextResponse);
    });
  });

  describe("error response format", () => {
    it("returns 400 status for validation errors", async () => {
      const result = validateToggleAgentTemplateFavoriteBody({});

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns error status and message in response body", async () => {
      const result = validateToggleAgentTemplateFavoriteBody({});

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBeDefined();
    });

    it("returns 'templateId is required' when templateId is missing", async () => {
      const result = validateToggleAgentTemplateFavoriteBody({ isFavourite: true });

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.message).toBe("templateId is required");
    });

    it("returns 'isFavourite is required' when isFavourite is missing", async () => {
      const result = validateToggleAgentTemplateFavoriteBody({ templateId: "template-1" });

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.message).toBe("isFavourite is required");
    });
  });

  describe("schema type inference", () => {
    it("schema should validate complete valid body", () => {
      const validBody = {
        templateId: "template-123",
        isFavourite: true,
      };

      const result = toggleAgentTemplateFavoriteBodySchema.safeParse(validBody);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templateId).toBe("template-123");
        expect(result.data.isFavourite).toBe(true);
      }
    });
  });
});

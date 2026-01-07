import { describe, expect, it } from "vitest";
import { sendEmailSchema } from "../sendEmailSchema";

describe("sendEmailSchema", () => {
  it("accepts valid input with required fields", () => {
    const input = {
      to: ["test@example.com"],
      subject: "Test Subject",
      body: "Test body content",
    };
    const result = sendEmailSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts valid input with optional room_id", () => {
    const input = {
      to: ["test@example.com"],
      subject: "Test Subject",
      body: "Test body content",
      room_id: "room-123",
    };
    const result = sendEmailSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts multiple recipients", () => {
    const input = {
      to: ["test1@example.com", "test2@example.com"],
      subject: "Test Subject",
      body: "Test body content",
    };
    const result = sendEmailSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects empty to array", () => {
    const input = {
      to: [],
      subject: "Test Subject",
      body: "Test body content",
    };
    const result = sendEmailSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects invalid email addresses", () => {
    const input = {
      to: ["not-an-email"],
      subject: "Test Subject",
      body: "Test body content",
    };
    const result = sendEmailSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects empty subject", () => {
    const input = {
      to: ["test@example.com"],
      subject: "",
      body: "Test body content",
    };
    const result = sendEmailSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects empty body", () => {
    const input = {
      to: ["test@example.com"],
      subject: "Test Subject",
      body: "",
    };
    const result = sendEmailSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const input = {
      to: ["test@example.com"],
    };
    const result = sendEmailSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

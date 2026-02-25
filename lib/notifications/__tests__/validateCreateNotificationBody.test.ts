import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { validateCreateNotificationBody } from "../validateCreateNotificationBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("validateCreateNotificationBody", () => {
  it("returns validated body for valid input", () => {
    const result = validateCreateNotificationBody({
      to: ["user@example.com"],
      subject: "Test Subject",
      text: "Hello world",
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual(
      expect.objectContaining({
        to: ["user@example.com"],
        subject: "Test Subject",
        text: "Hello world",
      }),
    );
  });

  it("returns validated body with all optional fields", () => {
    const result = validateCreateNotificationBody({
      to: ["user@example.com"],
      cc: ["cc@example.com"],
      subject: "Test Subject",
      text: "Hello",
      html: "<p>Hello</p>",
      headers: { "X-Custom": "value" },
      room_id: "room-123",
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual(
      expect.objectContaining({
        to: ["user@example.com"],
        cc: ["cc@example.com"],
        subject: "Test Subject",
        text: "Hello",
        html: "<p>Hello</p>",
        headers: { "X-Custom": "value" },
        room_id: "room-123",
      }),
    );
  });

  it("returns 400 when 'to' is missing", () => {
    const result = validateCreateNotificationBody({
      subject: "Test",
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when 'to' is empty array", () => {
    const result = validateCreateNotificationBody({
      to: [],
      subject: "Test",
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when 'to' contains invalid email", () => {
    const result = validateCreateNotificationBody({
      to: ["not-an-email"],
      subject: "Test",
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when 'subject' is missing", () => {
    const result = validateCreateNotificationBody({
      to: ["user@example.com"],
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when 'subject' is empty", () => {
    const result = validateCreateNotificationBody({
      to: ["user@example.com"],
      subject: "",
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when 'cc' contains invalid email", () => {
    const result = validateCreateNotificationBody({
      to: ["user@example.com"],
      subject: "Test",
      cc: ["not-valid"],
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});

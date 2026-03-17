import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateInboundEmailEvent } from "../validateInboundEmailEvent";

const baseEvent = {
  type: "email.received",
  created_at: "2026-03-03T20:35:43.000Z",
  data: {
    email_id: "5e165863-2671-4dbe-982f-2d297d337074",
    created_at: "2026-03-03T20:36:09.769Z",
    from: "sidney@recoupable.com",
    to: ["agent@mail.recoupable.com"],
    bcc: [],
    cc: [],
    message_id: "<mmb11dqz.21ac8e88-777e-445c-b1c1-71829c2b82a5@we.are.superhuman.com>",
    subject: "Add mp3s to Gatsby Grace files in sandbox",
    attachments: [],
  },
};

describe("validateInboundEmailEvent", () => {
  it("returns validated event for a valid payload with no attachments", () => {
    const result = validateInboundEmailEvent(baseEvent);
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual(baseEvent);
  });

  it("returns validated event when attachments have a string content_id", () => {
    const event = {
      ...baseEvent,
      data: {
        ...baseEvent.data,
        attachments: [
          {
            id: "27b096cb-2330-4f7a-94cf-1a272ad90106",
            filename: "image.png",
            content_type: "image/png",
            content_disposition: "inline",
            content_id: "abc123",
          },
        ],
      },
    };
    const result = validateInboundEmailEvent(event);
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual(event);
  });

  it("returns validated event when attachments have content_id: null", () => {
    const event = {
      ...baseEvent,
      data: {
        ...baseEvent.data,
        attachments: [
          {
            id: "27b096cb-2330-4f7a-94cf-1a272ad90106",
            filename: "All the Little Things.mp3",
            content_type: "audio/mpeg",
            content_disposition: "attachment",
            content_id: null,
          },
          {
            id: "439c31c4-19d9-43b3-becc-82831fa5be69",
            filename: "ADHD.mp3",
            content_type: "audio/mpeg",
            content_disposition: "attachment",
            content_id: null,
          },
        ],
      },
    };
    const result = validateInboundEmailEvent(event);
    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual(event);
  });

  it("returns 400 for invalid payload", () => {
    const result = validateInboundEmailEvent({ type: "wrong" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});

import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";

import { validateApifyWebhookBody } from "../validateApifyWebhookBody";

const validPayload = {
  userId: "user_1",
  createdAt: "2026-01-01T00:00:00Z",
  eventType: "ACTOR.RUN.SUCCEEDED",
  eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
  resource: { defaultDatasetId: "dataset_abc" },
};

describe("validateApifyWebhookBody", () => {
  it("returns the parsed payload when valid", () => {
    const result = validateApifyWebhookBody(validPayload);
    expect(result).toEqual(validPayload);
  });

  it.each([
    ["missing eventData.actorId", { ...validPayload, eventData: {} }],
    ["missing resource.defaultDatasetId", { ...validPayload, resource: {} }],
    ["missing top-level eventType", { ...validPayload, eventType: undefined }],
    ["non-object body", "nope"],
  ])("returns 400 NextResponse when %s", async (_, body) => {
    const result = validateApifyWebhookBody(body);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});

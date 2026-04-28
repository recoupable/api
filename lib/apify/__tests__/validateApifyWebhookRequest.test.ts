import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateApifyWebhookRequest } from "../validateApifyWebhookRequest";

function makeRequest(body: unknown, raw?: string) {
  return new NextRequest("http://localhost/api/apify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

describe("validateApifyWebhookRequest", () => {
  it("returns the parsed payload for a valid Apify request", async () => {
    const result = await validateApifyWebhookRequest(
      makeRequest({
        userId: "u",
        createdAt: "2026-01-01T00:00:00Z",
        eventType: "ACTOR.RUN.SUCCEEDED",
        eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
        resource: { defaultDatasetId: "ds_1" },
      }),
    );

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.eventData.actorId).toBe("dSCLg0C3YEZ83HzYX");
      expect(result.resource.defaultDatasetId).toBe("ds_1");
    }
  });

  it("returns a 200 NextResponse with the project error shape on missing fields", async () => {
    const result = await validateApifyWebhookRequest(makeRequest({ eventData: {}, resource: {} }));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(200);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(Array.isArray(body.missing_fields)).toBe(true);
      expect(typeof body.error).toBe("string");
    }
  });

  it("returns a 200 NextResponse with Invalid JSON for malformed bodies", async () => {
    const result = await validateApifyWebhookRequest(makeRequest(null, "not json"));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(200);
      const body = await result.json();
      expect(body).toEqual({ status: "error", error: "Invalid JSON" });
    }
  });
});

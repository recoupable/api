import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { validateApifyWebhookRequest } from "../validateApifyWebhookRequest";

function makeRequest(body: unknown, raw?: string) {
  return new NextRequest("http://localhost/api/apify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

describe("validateApifyWebhookRequest", () => {
  it("returns ok+data for a valid Apify payload", async () => {
    const req = makeRequest({
      userId: "u",
      createdAt: "2026-01-01T00:00:00Z",
      eventType: "ACTOR.RUN.SUCCEEDED",
      eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
      resource: { defaultDatasetId: "ds_1" },
    });

    const result = await validateApifyWebhookRequest(req);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.eventData.actorId).toBe("dSCLg0C3YEZ83HzYX");
      expect(result.data.resource.defaultDatasetId).toBe("ds_1");
    }
  });

  it("rejects payloads missing required fields", async () => {
    const req = makeRequest({ eventData: {}, resource: {} });
    const result = await validateApifyWebhookRequest(req);
    expect(result.ok).toBe(false);
  });

  it("rejects non-JSON bodies", async () => {
    const req = makeRequest(null, "not json");
    const result = await validateApifyWebhookRequest(req);
    expect(result).toEqual({ ok: false, error: "Invalid JSON" });
  });
});

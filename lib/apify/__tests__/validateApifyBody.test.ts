import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateApifyBody } from "../validateApifyBody";

describe("validateApifyBody", () => {
  it("returns the parsed body for a valid Apify payload", () => {
    const body = {
      userId: "u",
      createdAt: "2026-01-01T00:00:00Z",
      eventType: "ACTOR.RUN.SUCCEEDED",
      eventData: { actorId: "dSCLg0C3YEZ83HzYX" },
      resource: { defaultDatasetId: "ds_1" },
    };

    const result = validateApifyBody(body);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.eventData.actorId).toBe("dSCLg0C3YEZ83HzYX");
      expect(result.resource.defaultDatasetId).toBe("ds_1");
    }
  });

  it("returns a 200 NextResponse with the project error shape on missing fields", async () => {
    const result = validateApifyBody({ eventData: {}, resource: {} });

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(200);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(Array.isArray(body.missing_fields)).toBe(true);
      expect(typeof body.error).toBe("string");
    }
  });

  it("returns a NextResponse for non-object bodies", () => {
    expect(validateApifyBody(undefined)).toBeInstanceOf(NextResponse);
    expect(validateApifyBody("not an object")).toBeInstanceOf(NextResponse);
  });
});

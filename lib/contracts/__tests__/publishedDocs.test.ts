import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createImageBodySchema } from "@/lib/content/image/validateCreateImageBody";
import { createVideoBodySchema } from "@/lib/content/video/validateCreateVideoBody";
import { createLipsyncBodySchema } from "@/lib/content/lipsync/validateCreateLipsyncBody";
import { createCreditsSessionBodySchema } from "@/lib/stripe/createCreditsSessionSchemas";
import { validateChatRunRequest } from "@/lib/chat/runs/validateChatRunRequest";
import { validateGetResearchTrackStatsRequest } from "@/lib/research/validateGetResearchTrackStatsRequest";
import { creditsToUsd } from "@/lib/credits/creditsToUsd";
import { createMeasurementJobBodySchema } from "@/lib/research/measurement_jobs/validateCreateMeasurementJobRequest";
import fixture from "../fixtures/published-docs.json";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn().mockResolvedValue({ accountId: "fixture-account", orgId: null }),
}));
vi.mock("@/lib/research/ensureResearchCredits", () => ({
  ensureResearchCredits: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/research/measurement_jobs/ensureSongstatsPaymentMethod", () => ({
  ensureSongstatsPaymentMethod: vi.fn().mockResolvedValue(null),
}));

describe("published documentation examples against the current API contract", () => {
  it("accepts the reference-image request without dropping its references", () => {
    const parsed = createImageBodySchema.parse(fixture.examples.image);
    expect(parsed.image_urls).toEqual(fixture.examples.image.image_urls);
  });

  it("accepts the H3 video example with its native duration and resolution", () => {
    expect(createVideoBodySchema.parse(fixture.examples.video)).toMatchObject(
      fixture.examples.video,
    );
  });

  it("accepts the release-pending audio-driven example through its own contract", () => {
    expect(createLipsyncBodySchema.parse(fixture.examples.lipsync)).toEqual(
      fixture.examples.lipsync,
    );
  });

  it("accepts the whole-cent top-up example and preserves its dollar value", () => {
    const body = createCreditsSessionBodySchema.parse(fixture.examples.topup);
    expect(creditsToUsd(body.credits)).toBe(2.5);
  });

  it("accepts the published headless messages without provisioning a run", async () => {
    const result = await validateChatRunRequest(
      new NextRequest("https://api.example/api/chat/runs", {
        method: "POST",
        body: JSON.stringify(fixture.examples.headless),
      }),
    );
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse))
      expect(result.messages).toEqual(fixture.examples.headless.messages);
  });

  it("accepts the published track identifier and required source without a provider call", async () => {
    const query = new URLSearchParams(fixture.examples.trackStats);
    const result = await validateGetResearchTrackStatsRequest(
      new NextRequest(`https://api.example/api/research/track/stats?${query}`),
    );
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse))
      expect(result.params).toEqual(fixture.examples.trackStats);
  });

  it("accepts the retained historical backfill example without creating a job or checkout", () => {
    expect(createMeasurementJobBodySchema.parse(fixture.examples.historicalMeasurementJob)).toEqual(
      fixture.examples.historicalMeasurementJob,
    );
  });
});

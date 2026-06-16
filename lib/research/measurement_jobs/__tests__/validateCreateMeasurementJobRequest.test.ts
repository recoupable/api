import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateMeasurementJobRequest } from "../validateCreateMeasurementJobRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const post = (body: unknown) =>
  new NextRequest("http://x/api/research/measurement-jobs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("validateCreateMeasurementJobRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
  });

  it("returns the auth response (401) when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );
    const r = await validateCreateMeasurementJobRequest(
      post({ scope: { isrcs: ["X"] }, source: "historical" }),
    );
    expect((r as NextResponse).status).toBe(401);
  });

  it("400 when source is missing", async () => {
    const r = await validateCreateMeasurementJobRequest(post({ scope: { isrcs: ["X"] } }));
    expect((r as NextResponse).status).toBe(400);
  });

  it("400 when source is not current|historical", async () => {
    const r = await validateCreateMeasurementJobRequest(
      post({ scope: { isrcs: ["X"] }, source: "future" }),
    );
    expect((r as NextResponse).status).toBe(400);
  });

  it("400 when scope has zero keys", async () => {
    const r = await validateCreateMeasurementJobRequest(post({ scope: {}, source: "current" }));
    expect((r as NextResponse).status).toBe(400);
  });

  it("400 when scope has more than one key", async () => {
    const r = await validateCreateMeasurementJobRequest(
      post({ scope: { isrcs: ["X"], album_ids: ["A"] }, source: "current" }),
    );
    expect((r as NextResponse).status).toBe(400);
  });

  it("passes auth + body through on success, defaulting platforms to spotify", async () => {
    const r = await validateCreateMeasurementJobRequest(
      post({ scope: { album_ids: ["A1"] }, source: "historical" }),
    );
    expect(r).toEqual({
      accountId: "acc_1",
      body: { scope: { album_ids: ["A1"] }, source: "historical", platforms: ["spotify"] },
    });
  });
});

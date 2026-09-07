import { describe, it, expect, vi } from "vitest";
import { errorResponse } from "@/lib/networking/errorResponse";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

describe("errorResponse", () => {
  it("returns { status: 'error', error } at the given HTTP status with CORS headers", async () => {
    const result = errorResponse("Something went wrong", 400);
    const body = await result.json();

    expect(result.status).toBe(400);
    expect(body).toEqual({ status: "error", error: "Something went wrong" });
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("errorResponse with extra fields", () => {
  it("merges documented extra fields into the envelope without touching status or error", async () => {
    const result = errorResponse("audio_url is required", 400, { missing_fields: ["audio_url"] });
    const body = await result.json();

    expect(result.status).toBe(400);
    expect(body).toEqual({
      status: "error",
      error: "audio_url is required",
      missing_fields: ["audio_url"],
    });
  });

  it("never lets an extra field overwrite status or error", async () => {
    const result = errorResponse("audio_url_not_audio", 422, {
      status: "success",
      error: "nope",
      message: "audio_url answered 200 with content type text/html",
    });

    expect(await result.json()).toEqual({
      status: "error",
      error: "audio_url_not_audio",
      message: "audio_url answered 200 with content type text/html",
    });
  });
});

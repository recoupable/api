import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { endpointModelId } from "@/lib/credits/endpointModelId";

describe("endpointModelId", () => {
  it("names the endpoint as METHOD + route pattern, never the concrete URL", () => {
    const req = new NextRequest("http://localhost/api/research/tracks/abc123/measurements?x=1", {
      method: "GET",
    });
    expect(endpointModelId(req, "/api/research/tracks/[id]/measurements")).toBe(
      "GET /api/research/tracks/[id]/measurements",
    );
  });

  it("uses the request method", () => {
    const req = new NextRequest("http://localhost/api/artist/socials/scrape", { method: "POST" });
    expect(endpointModelId(req, "/api/artist/socials/scrape")).toBe(
      "POST /api/artist/socials/scrape",
    );
  });
});

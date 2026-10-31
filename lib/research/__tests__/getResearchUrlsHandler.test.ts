import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/research/urls/route";
import { validateArtistRequest } from "../validateArtistRequest";
import { handleArtistResearch } from "../handleArtistResearch";

vi.mock("@/lib/research/validateArtistRequest", () => ({ validateArtistRequest: vi.fn() }));
vi.mock("@/lib/research/handleArtistResearch", () => ({ handleArtistResearch: vi.fn() }));
const request = () => new NextRequest("http://localhost/api/research/urls?artist=Fixture");
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(validateArtistRequest).mockResolvedValue({ accountId: "fixture", artist: "Fixture" });
});

describe("research URLs through the exported GET route", () => {
  it("omits invalid links from map responses", async () => {
    vi.mocked(handleArtistResearch).mockResolvedValue({
      data: {
        valid: "https://example.com/creator",
        http: "http://example.com/creator",
        credential: "https://user:pass@example.com",
        script: "javascript:alert(1)",
        invalid: 42,
      },
    });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "success",
      urls: [{ domain: "valid", url: "https://example.com/creator" }],
    });
  });
  it("preserves valid documented array entries while filtering invalid ones", async () => {
    vi.mocked(handleArtistResearch).mockResolvedValue({
      data: [
        { domain: "valid", url: "https://example.com/creator" },
        { domain: "bad", url: "https://user@example.com" },
        { domain: "script", url: "javascript:alert(1)" },
        { domain: 42, url: "https://example.com" },
        null,
      ],
    });
    expect(await (await GET(request())).json()).toEqual({
      status: "success",
      urls: [{ domain: "valid", url: "https://example.com/creator" }],
    });
  });
  it("preserves the auth/credit short circuit before research", async () => {
    vi.mocked(validateArtistRequest).mockResolvedValue(
      NextResponse.json({ status: "error", error: "fixture denial" }, { status: 402 }),
    );
    const response = await GET(request());
    expect(response.status).toBe(402);
    expect(handleArtistResearch).not.toHaveBeenCalled();
  });
  it("preserves failed research status and body", async () => {
    vi.mocked(handleArtistResearch).mockResolvedValue({ error: "fixture failure", status: 429 });
    const response = await GET(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ status: "error", error: "fixture failure" });
  });
});

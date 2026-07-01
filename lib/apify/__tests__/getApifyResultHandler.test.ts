import { describe, it, expect, vi } from "vitest";
import { getApifyResultHandler } from "@/lib/apify/getApifyResultHandler";
import { handleInstagramProfileScraperResults } from "@/lib/apify/instagram/handleInstagramProfileScraperResults";
import { handleInstagramCommentsScraper } from "@/lib/apify/instagram/handleInstagramCommentsScraper";

vi.mock("@/lib/apify/instagram/handleInstagramProfileScraperResults", () => ({
  handleInstagramProfileScraperResults: vi.fn(),
}));
vi.mock("@/lib/apify/instagram/handleInstagramCommentsScraper", () => ({
  handleInstagramCommentsScraper: vi.fn(),
}));

describe("getApifyResultHandler", () => {
  it("maps the Instagram actor ids to their result handlers", () => {
    expect(getApifyResultHandler("dSCLg0C3YEZ83HzYX")).toBe(handleInstagramProfileScraperResults);
    expect(getApifyResultHandler("SbK00X0JYCPblD2wp")).toBe(handleInstagramCommentsScraper);
  });
  it("returns undefined for an unregistered actor id", () => {
    expect(getApifyResultHandler("unknown_actor")).toBeUndefined();
  });
});

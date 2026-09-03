import { describe, it, expect, afterEach, vi } from "vitest";
import { getRecoupApiUrl } from "@/lib/agent/tools/getRecoupApiUrl";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getRecoupApiUrl", () => {
  it("uses the canonical production domain in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", "api-abc123-recoup.vercel.app");

    expect(getRecoupApiUrl()).toBe("https://api.recoupable.dev");
  });

  it("uses the deployment's own url on a preview, so a sandbox calls back to the api that spawned it", () => {
    // A preview-minted Privy token is rejected by production (measured 401,
    // recoupable/app#2052), so a preview sandbox pointed at prod cannot
    // authenticate at all.
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "api-abc123-recoup.vercel.app");

    expect(getRecoupApiUrl()).toBe("https://api-abc123-recoup.vercel.app");
  });

  it("prefers an explicit override over everything else", () => {
    vi.stubEnv("RECOUP_API_URL", "https://test-recoup-api.vercel.app");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "api-abc123-recoup.vercel.app");

    expect(getRecoupApiUrl()).toBe("https://test-recoup-api.vercel.app");
  });

  it("strips a trailing slash so callers can append /api cleanly", () => {
    vi.stubEnv("RECOUP_API_URL", "https://test-recoup-api.vercel.app/");

    expect(getRecoupApiUrl()).toBe("https://test-recoup-api.vercel.app");
  });

  it("falls back to production when nothing is set (local dev, tests)", () => {
    vi.stubEnv("RECOUP_API_URL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("VERCEL_URL", "");

    expect(getRecoupApiUrl()).toBe("https://api.recoupable.dev");
  });
});

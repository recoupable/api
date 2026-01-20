import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBaseUrl } from "../getBaseUrl";

describe("getBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns HTTPS URL when VERCEL_URL is set", () => {
    process.env.VERCEL_URL = "my-app.vercel.app";

    const result = getBaseUrl();

    expect(result).toBe("https://my-app.vercel.app");
  });

  it("returns localhost when VERCEL_URL is not set", () => {
    delete process.env.VERCEL_URL;

    const result = getBaseUrl();

    expect(result).toBe("http://localhost:3000");
  });

  it("returns localhost when VERCEL_URL is empty string", () => {
    process.env.VERCEL_URL = "";

    const result = getBaseUrl();

    expect(result).toBe("http://localhost:3000");
  });
});

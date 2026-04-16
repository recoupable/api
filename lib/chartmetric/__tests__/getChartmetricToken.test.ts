import { describe, it, expect, vi, beforeEach } from "vitest";
import { getChartmetricToken } from "../getChartmetricToken";
import { resetTokenCache } from "../resetTokenCache";

describe("getChartmetricToken", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    resetTokenCache();
    process.env = { ...originalEnv };
  });

  it("throws when CHARTMETRIC_REFRESH_TOKEN is not set", async () => {
    delete process.env.CHARTMETRIC_REFRESH_TOKEN;

    await expect(getChartmetricToken()).rejects.toThrow("CHARTMETRIC_REFRESH_TOKEN");
  });

  it("returns token on successful exchange", async () => {
    process.env.CHARTMETRIC_REFRESH_TOKEN = "test-refresh-token";

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ token: "test-access-token", expires_in: 3600 }),
    } as Response);

    const token = await getChartmetricToken();

    expect(token).toBe("test-access-token");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.chartmetric.com/api/token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshtoken: "test-refresh-token" }),
      }),
    );
  });

  it("throws when token exchange returns non-ok response", async () => {
    process.env.CHARTMETRIC_REFRESH_TOKEN = "test-refresh-token";

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await expect(getChartmetricToken()).rejects.toThrow("401");
  });

  it("caches the token and does not fetch again on second call", async () => {
    process.env.CHARTMETRIC_REFRESH_TOKEN = "test-refresh-token";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ token: "cached-token", expires_in: 3600 }),
    } as Response);

    const token1 = await getChartmetricToken();
    const token2 = await getChartmetricToken();

    expect(token1).toBe("cached-token");
    expect(token2).toBe("cached-token");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws when response has no token", async () => {
    process.env.CHARTMETRIC_REFRESH_TOKEN = "test-refresh-token";

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ expires_in: 3600 }),
    } as Response);

    await expect(getChartmetricToken()).rejects.toThrow("token");
  });
});

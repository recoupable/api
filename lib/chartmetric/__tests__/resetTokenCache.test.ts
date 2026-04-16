import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("resetTokenCache", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV, CHARTMETRIC_REFRESH_TOKEN: "refresh-abc" };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("is exported from its own module file", async () => {
    const mod = await import("../resetTokenCache");
    expect(typeof mod.resetTokenCache).toBe("function");
  });

  it("clears the cached token so the next getChartmetricToken refetches", async () => {
    const { getChartmetricToken } = await import("../getChartmetricToken");
    const { resetTokenCache } = await import("../resetTokenCache");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "t1", expires_in: 3600 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    resetTokenCache();
    await getChartmetricToken();
    await getChartmetricToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resetTokenCache();
    await getChartmetricToken();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

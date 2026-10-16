import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetModules();
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function load() {
  return (await import("../getRecoupMlcAccessToken")).getRecoupMlcAccessToken;
}

it("fails before any provider request when Recoup MLC credentials are not configured", async () => {
  vi.stubEnv("MLC_USERNAME", "");
  vi.stubEnv("MLC_PASSWORD", "");
  const getRecoupMlcAccessToken = await load();
  await expect(getRecoupMlcAccessToken()).rejects.toThrow(
    "Recoup MLC credentials are not configured",
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it("treats a partial credential pair as not configured", async () => {
  vi.stubEnv("MLC_USERNAME", "fixture-user");
  vi.stubEnv("MLC_PASSWORD", "");
  const getRecoupMlcAccessToken = await load();
  await expect(getRecoupMlcAccessToken()).rejects.toThrow(
    "Recoup MLC credentials are not configured",
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it("never places configured credentials in an authentication error", async () => {
  vi.stubEnv("MLC_USERNAME", "fixture-user");
  vi.stubEnv("MLC_PASSWORD", "fixture-secret");
  fetcher.mockResolvedValue(new Response("private provider body", { status: 401 }));
  const getRecoupMlcAccessToken = await load();
  const failure = await getRecoupMlcAccessToken().catch((error: Error) => error);
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toBe("MLC authentication HTTP 401");
  expect((failure as Error).message).not.toContain("fixture-secret");
  expect((failure as Error).message).not.toContain("private provider body");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe("https://public-api.themlc.com/oauth/token");
});

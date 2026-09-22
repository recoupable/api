import { it, expect, vi } from "vitest";
import { createChartmetricTokenProvider } from "../createChartmetricTokenProvider";
it("shares concurrent token requests and caches the result", async () => {
  const f = vi.fn().mockResolvedValue(new Response('{"token":"access","expires_in":3600}'));
  const get = createChartmetricTokenProvider("refresh", f);
  expect(await Promise.all([get(), get()])).toEqual(["access", "access"]);
  expect(await get()).toBe("access");
  expect(f).toHaveBeenCalledOnce();
});

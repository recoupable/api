import { afterEach, expect, it, vi } from "vitest";
import { resolveSiteFanReturnUrl } from "../resolveSiteFanReturnUrl";
afterEach(() => vi.unstubAllEnvs());
it("prefers explicit destination, then existing configuration, then public site URL", () => {
  vi.stubEnv("SITES_PUBLIC_ORIGIN", "https://public.example");
  expect(
    resolveSiteFanReturnUrl("site", "https://configured.example", "https://selected.example"),
  ).toBe("https://selected.example");
  expect(resolveSiteFanReturnUrl("site", "https://configured.example")).toBe(
    "https://configured.example",
  );
  expect(resolveSiteFanReturnUrl("site")).toBe("https://public.example/s/site");
});
it("retains the default origin", () => {
  vi.stubEnv("SITES_PUBLIC_ORIGIN", "");
  expect(resolveSiteFanReturnUrl("site")).toBe("https://app.recoupable.dev/s/site");
});
it.each([
  "http://unsafe.example",
  "https://user:pass@example.com",
  "https://example.com/#fragment",
])("rejects unsafe destination %s", value => {
  expect(() => resolveSiteFanReturnUrl("site", undefined, value)).toThrow();
});

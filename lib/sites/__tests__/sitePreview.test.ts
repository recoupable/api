import { afterEach, expect, it, vi } from "vitest";
import { signSitePreview } from "../preview/signSitePreview";
import { verifySitePreview } from "../preview/verifySitePreview";
const id = "11111111-1111-4111-8111-111111111111";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("binds a preview to its site and rejects tampering and expiry", () => {
  vi.stubEnv("SITES_JOB_SECRET", "test-preview");
  vi.useFakeTimers();
  const token = signSitePreview(id, "owner");
  expect(verifySitePreview(token, id).accountId).toBe("owner");
  expect(() => verifySitePreview(token, "other-site")).toThrow();
  expect(() => verifySitePreview(token + "x", id)).toThrow();
  vi.advanceTimersByTime(30 * 60000);
  expect(() => verifySitePreview(token, id)).toThrow("Preview expired");
});

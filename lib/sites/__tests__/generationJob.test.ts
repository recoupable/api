import { expect, it, vi } from "vitest";
import { signGenerationJob } from "../production/signGenerationJob";
import { verifyGenerationJob } from "../production/verifyGenerationJob";
it("binds jobs to the signed-in account and site and rejects tampering", () => {
  vi.stubEnv("SUPABASE_KEY", "test-only-signing-key");
  const token = signGenerationJob("run", "site", "account");
  expect(verifyGenerationJob(token, "site", "account").runId).toBe("run");
  expect(() => verifyGenerationJob(token, "other", "account")).toThrow();
  expect(() => verifyGenerationJob(token, "site", "other")).toThrow();
  expect(() => verifyGenerationJob(token + "x", "site", "account")).toThrow();
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 8 * 86400000);
  expect(() => verifyGenerationJob(token, "site", "account")).toThrow();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

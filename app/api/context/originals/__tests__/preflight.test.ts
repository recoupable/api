import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OPTIONS } from "../route";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { consumeOAuthRateLimit } from "@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit";
import { storeContextOriginal } from "@/lib/context/originals/storeContextOriginal";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/oauth_rate_limits/consumeOAuthRateLimit", () => ({
  consumeOAuthRateLimit: vi.fn(),
}));
vi.mock("@/lib/context/originals/storeContextOriginal", () => ({ storeContextOriginal: vi.fn() }));
vi.mock("@/lib/context/originals/reconcileContextOriginal", () => ({
  reconcileContextOriginal: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CONTEXT_ORIGINAL_INTAKE_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());
const request = (method = "POST", headers = "content-type,authorization,x-api-key") =>
  new NextRequest("https://example.test/api/context/originals", {
    method: "OPTIONS",
    headers: {
      origin: "https://chat.recoupable.dev",
      "access-control-request-method": method,
      "access-control-request-headers": headers,
    },
  });
it("keeps browser intake unavailable while the pilot is disabled", () => {
  vi.stubEnv("CONTEXT_ORIGINAL_INTAKE_ENABLED", "");
  const res = OPTIONS(request());
  expect(res.status).toBe(503);
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(validateAuthContext).not.toHaveBeenCalled();
  expect(consumeOAuthRateLimit).not.toHaveBeenCalled();
  expect(storeContextOriginal).not.toHaveBeenCalled();
});
it("advertises only GET/POST/OPTIONS and explicit auth headers without credentials", () => {
  const res = OPTIONS(request());
  expect(res.status).toBe(204);
  expect(res.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
  expect(res.headers.get("access-control-allow-headers")).toContain("Authorization");
  expect(res.headers.get("access-control-expose-headers")).toContain("Retry-After");
  expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  expect(validateAuthContext).not.toHaveBeenCalled();
  expect(consumeOAuthRateLimit).not.toHaveBeenCalled();
  expect(storeContextOriginal).not.toHaveBeenCalled();
});
it("does not advertise other application methods", () => {
  expect(OPTIONS(request("PUT")).status).toBe(405);
});
it("rejects unsupported custom headers", () => {
  expect(OPTIONS(request("POST", "x-caller-identity")).status).toBe(400);
});

vi.mock("@/lib/context/originals/readRetainedContextOriginal", () => ({
  readRetainedContextOriginal: vi.fn(),
}));

it("advertises authenticated GET without performing a read", () => {
  expect(OPTIONS(request("GET")).status).toBe(204);
  expect(validateAuthContext).not.toHaveBeenCalled();
});

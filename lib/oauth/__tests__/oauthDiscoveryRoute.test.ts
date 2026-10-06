import { afterEach, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import discovery from "../../../pages/api/oauth-discovery";
const { limit, handler } = vi.hoisted(() => ({ limit: vi.fn(async () => 12), handler: vi.fn() }));
vi.mock("../checkOAuthRateLimit", () => ({ checkOAuthRateLimit: limit }));
vi.mock("../getOAuthRuntime", () => ({ getOAuthRuntime: () => ({ handler }) }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("budgets public discovery before invoking the provider", async () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  const req = {
    method: "GET",
    url: "/.well-known/oauth-authorization-server/api/oauth",
  } as NextApiRequest;
  const res = { setHeader: vi.fn(), status: vi.fn(), end: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  await discovery(req, res as unknown as NextApiResponse);
  expect(limit).toHaveBeenCalledWith(req);
  expect(res.status).toHaveBeenCalledWith(429);
  expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "12");
  expect(handler).not.toHaveBeenCalled();
});

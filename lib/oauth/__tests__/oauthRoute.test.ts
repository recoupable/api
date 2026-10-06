import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, expect, it, vi } from "vitest";
import oauth from "../../../pages/api/oauth/[...path]";

const { runtime } = vi.hoisted(() => ({ runtime: vi.fn() }));
vi.mock("../getOAuthRuntime", () => ({ getOAuthRuntime: runtime }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function response() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    end: vi.fn(),
    json: vi.fn(),
    headersSent: false,
  };
  res.status.mockReturnValue(res);
  return res;
}
it("does not initialize secrets, database, or provider when disabled", async () => {
  vi.stubEnv("OAUTH_ENABLED", "false");
  const res = response();
  await oauth({} as NextApiRequest, res as unknown as NextApiResponse);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(runtime).not.toHaveBeenCalled();
});
it("returns a generic unavailable response when enabled initialization fails", async () => {
  vi.stubEnv("OAUTH_ENABLED", "true");
  runtime.mockImplementation(() => {
    throw new Error("secret-material");
  });
  const res = response();
  await oauth({} as NextApiRequest, res as unknown as NextApiResponse);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith({ error: "oauth_unavailable" });
});

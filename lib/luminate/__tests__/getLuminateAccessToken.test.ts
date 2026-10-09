import { describe, expect, it, vi } from "vitest";
import { getLuminateAccessToken } from "../getLuminateAccessToken";
describe("Luminate token cache", () => {
  it("normalizes network and malformed authentication failures without upstream details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private upstream detail")));
    await expect(
      getLuminateAccessToken({ apiKey: "k", username: "u", password: "p" }),
    ).rejects.toThrow("Luminate authentication temporarily unavailable");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(null)));
    await expect(
      getLuminateAccessToken({ apiKey: "k", username: "u", password: "p" }),
    ).rejects.toThrow("Invalid Luminate authentication response");
  });
  it("shares concurrent authentication and refreshes when credentials rotate", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ access_token: "t", expires_in: 86400 }));
    vi.stubGlobal("fetch", fetcher);
    const credentials = { apiKey: "k", username: "u", password: "p" };
    expect(
      await Promise.all([getLuminateAccessToken(credentials), getLuminateAccessToken(credentials)]),
    ).toEqual(["t", "t"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(Response.json({ access_token: "rotated", expires_in: 86400 }));
    expect(await getLuminateAccessToken({ ...credentials, password: "new" })).toBe("rotated");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

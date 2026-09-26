import { expect, it, vi } from "vitest";
import { createMlcAccessTokenProvider } from "../createMlcAccessTokenProvider";

it("exchanges Recoup MLC credentials for the ID token and shares one login", async () => {
  const fetcher = vi.fn(async () =>
    Response.json({ idToken: "id-token", accessToken: "other", expiresIn: 3600 }),
  );
  const token = createMlcAccessTokenProvider({ username: "user", password: "password", fetcher });
  expect(await Promise.all([token(), token()])).toEqual(["id-token", "id-token"]);
  expect(await token()).toBe("id-token");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith(
    "https://public-api.themlc.com/oauth/token",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ username: "user", password: "password" }),
    }),
  );
});

it("refreshes before expiry and never includes provider response or credentials in errors", async () => {
  let now = 0;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ idToken: "first", expiresIn: 120 }))
    .mockResolvedValueOnce(Response.json({ idToken: "second", expiresIn: 120 }));
  const token = createMlcAccessTokenProvider({
    username: "user",
    password: "password",
    fetcher,
    now: () => now,
  });
  expect(await token()).toBe("first");
  now = 61_000;
  expect(await token()).toBe("second");
  fetcher.mockResolvedValueOnce(new Response("private response", { status: 401 }));
  now = 122_000;
  await expect(token()).rejects.toThrow("MLC authentication HTTP 401");
});

it("rejects malformed authentication bodies without exposing them", async () => {
  const fetcher = vi.fn(async () => new Response("private malformed content", { status: 200 }));
  const token = createMlcAccessTokenProvider({ username: "user", password: "password", fetcher });
  await expect(token()).rejects.toThrow("MLC authentication returned an invalid response");
});

it("rejects an access token without the ID token used by MLC data routes", async () => {
  const fetcher = vi.fn(async () => Response.json({ accessToken: "wrong-token" }));
  const token = createMlcAccessTokenProvider({ username: "user", password: "password", fetcher });
  await expect(token()).rejects.toThrow("MLC authentication returned no ID token");
});

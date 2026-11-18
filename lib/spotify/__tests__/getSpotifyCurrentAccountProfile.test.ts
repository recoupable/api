import { afterEach, expect, it, vi } from "vitest";
import { getSpotifyCurrentAccountProfile } from "../getSpotifyCurrentAccountProfile";

afterEach(() => vi.unstubAllGlobals());

it("requests the fixed current-account endpoint with the caller's token and abort signal", async () => {
  const signal = new AbortController().signal;
  const fetch = vi.fn();
  fetch.mockResolvedValue(
    Response.json({
      id: "provider-account",
      email: "fan@example.com",
      display_name: "Fan",
      country: "US",
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const profile = await getSpotifyCurrentAccountProfile("provider-token", signal);
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://api.spotify.com/v1/me", {
    headers: { Authorization: "Bearer provider-token" },
    cache: "no-store",
    signal,
  });
  expect(profile).toEqual({
    id: "provider-account",
    email: "fan@example.com",
    display_name: "Fan",
  });
});

it.each([
  { id: "provider-account" },
  { id: "provider-account", email: null, display_name: null },
  { id: "x".repeat(255), email: "fan@example.com", display_name: "n".repeat(255) },
])("preserves optional/null profile fields and accepted boundaries: %j", async profile => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(profile)));
  await expect(
    getSpotifyCurrentAccountProfile("token", new AbortController().signal),
  ).resolves.toEqual(profile);
});

it.each([
  {},
  { id: "" },
  { id: "x".repeat(256) },
  { id: "account", email: "invalid" },
  { id: "account", email: "a".repeat(243) + "@example.com" },
  { id: "account", display_name: "n".repeat(256) },
])("rejects a malformed provider profile: %j", async profile => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(profile)));
  await expect(
    getSpotifyCurrentAccountProfile("token", new AbortController().signal),
  ).rejects.toThrow();
});

it("rejects unsuccessful HTTP without parsing a profile", async () => {
  const json = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json }));
  await expect(
    getSpotifyCurrentAccountProfile("token", new AbortController().signal),
  ).rejects.toThrow();
  expect(json).not.toHaveBeenCalled();
});

it("propagates malformed JSON without producing a profile", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json")));
  await expect(
    getSpotifyCurrentAccountProfile("token", new AbortController().signal),
  ).rejects.toThrow();
});

it.each([new Error("network unavailable"), new DOMException("Aborted", "AbortError")])(
  "does not produce a profile after a rejected provider fetch",
  async error => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(
      getSpotifyCurrentAccountProfile("token", new AbortController().signal),
    ).rejects.toBe(error);
  },
);

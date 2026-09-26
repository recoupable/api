import { afterEach, expect, it, vi } from "vitest";
import { parseContextReleaseUrl } from "../parseContextReleaseUrl";
import { processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());

const account = "00000000-0000-4000-8000-000000000001";
const album = "3vX9jU6Ix8t7XsAWLoZs10";

it("canonicalizes a Spotify album locator without accepting track or lookalike URLs", () => {
  expect(
    parseContextReleaseUrl(`https://open.spotify.com/intl-en/album/${album}?si=sharing`),
  ).toEqual({
    id: album,
    url: `https://open.spotify.com/album/${album}`,
  });
  for (const url of [
    `https://open.spotify.com/track/${album}`,
    `https://open.spotify.com.evil.test/album/${album}`,
    `http://open.spotify.com/album/${album}`,
    `https://open.spotify.com/album/short`,
  ])
    expect(() => parseContextReleaseUrl(url)).toThrow();
});

it("saves an album locator in the selected workspace without dispatching a track worker", async () => {
  const rpc = vi.fn(async () => ({ id: "request", status: "partial" }));
  const dispatch = vi.fn();
  const result = await processContextOperation(
    account,
    {
      action: "ingest_release",
      url: `https://open.spotify.com/album/${album}?si=sharing`,
      idempotency_key: "release-test",
    },
    {
      authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
      rpc,
      dispatch,
    },
  );
  expect(rpc).toHaveBeenCalledWith("create_context_release_request", {
    p_owner: account,
    p_actor: account,
    p_album: album,
    p_key: "release-test",
  });
  expect("request" in result && result.request?.status).toBe("partial");
  expect(dispatch).not.toHaveBeenCalled();
});

it("rejects a track URL before creating a release request", async () => {
  const rpc = vi.fn();
  await expect(
    processContextOperation(
      account,
      {
        action: "ingest_release",
        url: `https://open.spotify.com/track/${album}`,
        idempotency_key: "bad",
      },
      {
        authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
        rpc,
        dispatch: vi.fn(),
      },
    ),
  ).rejects.toThrow("album URL");
  expect(rpc).not.toHaveBeenCalled();
});

it("keeps release verification disabled before reading or dispatching a request", async () => {
  const rpc = vi.fn();
  const dispatchRelease = vi.fn();
  await expect(
    processContextOperation(
      account,
      { action: "verify_release", request_id: account },
      {
        authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
        rpc,
        dispatch: vi.fn(),
        dispatchRelease,
      },
    ),
  ).rejects.toThrow("not enabled");
  expect(rpc).not.toHaveBeenCalled();
  expect(dispatchRelease).not.toHaveBeenCalled();
});

it("queues only a saved, request-bound release when the server permits verification", async () => {
  vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
  const rpc = vi.fn(async () => ({
    subjectId: account,
    kind: "release",
    identityConfirmed: false,
    availableFields: ["spotify_id"],
    reusableModules: [],
  }));
  const dispatch = vi.fn();
  const dispatchRelease = vi.fn(async () => undefined);
  const result = await processContextOperation(
    account,
    { action: "verify_release", request_id: account },
    {
      authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
      rpc,
      dispatch,
      dispatchRelease,
    },
  );
  expect(rpc).toHaveBeenCalledWith("list_context_release_request_target", {
    p_owner: account,
    p_request: account,
  });
  expect(dispatchRelease).toHaveBeenCalledWith(account, account, account);
  expect(dispatch).not.toHaveBeenCalled();
  expect(result).toEqual({ request_id: account, verificationQueued: true });
});

it("does not queue a release when the saved request is inaccessible", async () => {
  vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
  const dispatchRelease = vi.fn();
  await expect(
    processContextOperation(
      account,
      { action: "verify_release", request_id: account },
      {
        authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
        rpc: async () => {
          throw new Error("Release request is not ready");
        },
        dispatch: vi.fn(),
        dispatchRelease,
      },
    ),
  ).rejects.toThrow("Release request is not ready");
  expect(dispatchRelease).not.toHaveBeenCalled();
});

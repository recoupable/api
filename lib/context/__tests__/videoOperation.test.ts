import { expect, it, vi } from "vitest";
import { parseContextVideoUrl } from "../parseContextVideoUrl";
import { processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

const account = "00000000-0000-4000-8000-000000000001";
const workspace = "00000000-0000-4000-8000-000000000002";
const video = "AbCdEfGhI_1";
const canonical = `https://www.youtube.com/watch?v=${video}`;
const track = "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB";
const notOneVideo = [
  track,
  "https://open.spotify.com/album/2ay96C6SLNv9urvXKD3ecB",
  "https://www.youtube.com/playlist?list=PLexample",
  `https://www.youtube.com/watch?v=${video}&v=OtherIdAB_2`,
  `http://www.youtube.com/watch?v=${video}`,
  `https://www.youtube.com.evil.test/watch?v=${video}`,
  `https://user:secret@youtu.be/${video}`,
  "https://www.youtube.com/channel/UCexample",
];

it.each([
  `https://youtu.be/${video}?t=4`,
  `https://www.youtube.com/watch?v=${video}&si=sharing`,
  `https://youtube.com/shorts/${video}`,
  `https://m.youtube.com/watch?v=${video}`,
])("canonicalizes one video locator to its watch URL: %s", url => {
  expect(parseContextVideoUrl(url)).toEqual({ id: video, url: canonical });
});

it.each(notOneVideo)("rejects anything that is not exactly one YouTube video: %s", url => {
  expect(() => parseContextVideoUrl(url)).toThrow();
});

it("points a Spotify track at ingest instead of silently accepting it as a video", () => {
  expect(() => parseContextVideoUrl(track)).toThrow("Spotify tracks use ingest");
});

it("saves a video locator in the selected workspace without dispatching any worker", async () => {
  const saved = {
    id: "request",
    status: "partial",
    input: { kind: "video", url: canonical, videoId: video, identityConfirmed: false },
  };
  const rpc = vi.fn(async () => saved);
  const dispatch = vi.fn();
  const dispatchRelease = vi.fn();
  const authorize = vi.fn(async () => ({
    accountId: account,
    ownerId: workspace,
    organizationId: workspace,
  }));
  const result = await processContextOperation(
    account,
    {
      action: "ingest_video",
      url: `https://youtu.be/${video}?t=4`,
      organization_id: workspace,
      idempotency_key: "video-test",
    },
    { authorize, rpc, dispatch, dispatchRelease },
  );
  expect(authorize).toHaveBeenCalledWith(account, workspace);
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("create_context_video_request", {
    p_owner: workspace,
    p_actor: account,
    p_video: video,
    p_key: "video-test",
  });
  expect(dispatch).not.toHaveBeenCalled();
  expect(dispatchRelease).not.toHaveBeenCalled();
  expect("request" in result ? result.request : null).toEqual(saved);
});

it("uses the personal workspace when no organization is selected", async () => {
  const rpc = vi.fn(async () => ({ id: "request", status: "partial" }));
  await processContextOperation(
    account,
    { action: "ingest_video", url: canonical, idempotency_key: "personal" },
    {
      authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
      rpc,
      dispatch: vi.fn(),
    },
  );
  expect(rpc).toHaveBeenCalledWith("create_context_video_request", {
    p_owner: account,
    p_actor: account,
    p_video: video,
    p_key: "personal",
  });
});

it("rejects a track, playlist or lookalike host before authorization or storage", async () => {
  const authorize = vi.fn();
  const rpc = vi.fn();
  const dispatch = vi.fn();
  for (const url of notOneVideo)
    await expect(
      processContextOperation(
        account,
        { action: "ingest_video", url, idempotency_key: "bad" },
        { authorize, rpc, dispatch },
      ),
    ).rejects.toMatchObject({
      issues: [
        {
          code: "custom",
          path: ["url"],
          message: "Use a single YouTube video URL; Spotify tracks use ingest",
        },
      ],
    });
  expect(authorize).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});

it("does not accept research topics or direction that would imply collection", async () => {
  const rpc = vi.fn();
  for (const extra of [{ topics: ["lyrics"] }, { direction: "transcribe the lyrics" }])
    await expect(
      processContextOperation(
        account,
        { action: "ingest_video", url: canonical, idempotency_key: "strict", ...extra },
        { authorize: vi.fn(), rpc, dispatch: vi.fn() },
      ),
    ).rejects.toMatchObject({
      issues: [{ code: "unrecognized_keys", keys: Object.keys(extra), path: [] }],
    });
  expect(rpc).not.toHaveBeenCalled();
});

it("keeps track ingest Spotify-only and names ingest_video for a YouTube URL", async () => {
  const rpc = vi.fn();
  const dispatch = vi.fn();
  await expect(
    processContextOperation(
      account,
      { action: "ingest", url: canonical, idempotency_key: "track-path" },
      {
        authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
        rpc,
        dispatch,
      },
    ),
  ).rejects.toThrow("ingest_video");
  expect(rpc).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});

import { beforeEach, expect, it, vi } from "vitest";
import { getSitePlaybackAudio } from "../getSitePlaybackAudio";
import type { Site } from "../schema";
const m = vi.hoisted(() => ({ rpc: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: m.rpc }));
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: m.sign,
}));
const releaseUrl = "https://open.spotify.com/track/4bbDlzPasNSFI1l69mx2zx";
const site = {
  owner_id: "owner",
  published: { releaseUrl, production: { context: { engine: { requestIds: ["request"] } } } },
} as Site;
const doc = (key = "owner/context-audio/recording.wav", url = releaseUrl, status = "accepted") => ({
  topic: "audio_source",
  status,
  text: JSON.stringify({ spotifyUrl: url, storage: { bucket: "user-files", key } }),
});
beforeEach(() => {
  vi.resetAllMocks();
  m.sign.mockResolvedValue("https://storage.test/signed.wav");
});
it("signs only the published recording from the owner's context request", async () => {
  m.rpc.mockResolvedValue([doc()]);
  expect(await getSitePlaybackAudio(site)).toBe("https://storage.test/signed.wav");
  expect(m.rpc).toHaveBeenCalledWith("read_context_documents", {
    p_owner: "owner",
    p_request: "request",
  });
  expect(m.sign).toHaveBeenCalledWith({
    key: "owner/context-audio/recording.wav",
    expiresInSeconds: 3600,
  });
});
it.each([
  doc("other/context-audio/recording.wav"),
  doc("owner/context-audio/../secret.wav"),
  doc(undefined, "https://open.spotify.com/track/other"),
  doc(undefined, undefined, "rejected"),
])("does not expose another file or rejected recording", async document => {
  m.rpc.mockResolvedValue([document]);
  expect(await getSitePlaybackAudio(site)).toBeNull();
  expect(m.sign).not.toHaveBeenCalled();
});
it("does not expose drafts or fail the public game when storage fails", async () => {
  expect(await getSitePlaybackAudio({ ...site, published: null })).toBeNull();
  expect(m.rpc).not.toHaveBeenCalled();
  m.rpc.mockRejectedValue(new Error("unavailable"));
  expect(await getSitePlaybackAudio(site)).toBeNull();
});

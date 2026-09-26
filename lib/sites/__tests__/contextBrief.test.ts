import { beforeEach, expect, it, vi } from "vitest";
import { readSiteContextBrief } from "../production/readSiteContextBrief";
import { collectReleaseContext } from "../production/collectReleaseContext";
import type { Site } from "../schema";
const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  access: vi.fn(),
  music: vi.fn(),
  research: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: m.rpc }));
vi.mock("../authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: m.access }));
vi.mock("../production/analyzeReleaseMusic", () => ({ analyzeReleaseMusic: m.music }));
vi.mock("../production/researchArtist", () => ({ researchArtist: m.research }));
vi.mock("../production/resolveReleaseContext", () => ({ resolveReleaseContext: m.resolve }));
const id = "11111111-1111-4111-8111-111111111111";
const source = "22222222-2222-4222-8222-222222222222";
const track = "2zpWJxfuyxqCYhpsAqH7Uh";
const site = {
  owner_id: id,
  release_url: `https://open.spotify.com/track/${track}`,
  draft: null,
} as Site;
const doc = {
  id,
  resultId: id,
  ownerId: id,
  subjectId: id,
  topic: "release_metadata",
  version: 1,
  status: "accepted",
  evidenceKind: "observation",
  coverage: "partial",
  sourceVersionIds: [source],
  sources: [{ versionId: source, url: site.release_url }],
  text: JSON.stringify({
    trackId: track,
    title: "Hate U",
    artists: [{ name: "chillpill" }],
    release: { date: "2021-06-25", artwork: [] },
  }),
};
let snapshot: Record<string, any>;
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue(id);
  snapshot = {
    id,
    state: "saved",
    superseded: false,
    purpose: "creative_direction",
    brief: {
      request_ids: [id],
      documents: [
        doc,
        {
          ...doc,
          topic: "song_summary",
          evidenceKind: "interpretation",
          text: "Preview-only analysis; uncertain full-song meaning.",
          sources: [
            { versionId: source, url: "https://p.scdn.co/mp3-preview/example?cid=public-client" },
          ],
        },
      ],
    },
  };
  m.rpc.mockImplementation(async () => snapshot);
});
it("hands saved analysis and attribution to Sites without collecting again", async () => {
  const context = await collectReleaseContext(site, id, id);
  expect(context.engine?.documents.find(d => d.topic === "song_summary")?.text).toContain(
    "Preview-only",
  );
  expect(context.engine?.documents[0].sourceVersionIds).toEqual([source]);
  expect(context.music.status).toBe("saved-analysis");
  expect(context.music.coverage).toBe("source-defined");
  expect(m.rpc).toHaveBeenCalledWith("read_context_brief", { p_owner: id, p_brief: id });
  expect(m.music).not.toHaveBeenCalled();
  expect(m.research).not.toHaveBeenCalled();
  expect(m.resolve).not.toHaveBeenCalled();
});
it.each([
  { state: "unavailable", brief: null },
  { superseded: true },
  { purpose: "playlist_pitch" },
])("rejects unusable snapshot %j", async patch => {
  Object.assign(snapshot, patch);
  await expect(readSiteContextBrief(site, id, id)).rejects.toThrow("current, available");
});
it("rejects a different song even in the same workspace", async () => {
  await expect(
    readSiteContextBrief(
      { ...site, release_url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB" },
      id,
      id,
    ),
  ).rejects.toThrow("this site's Spotify track");
});
it("checks workspace authorization before reading evidence", async () => {
  m.access.mockRejectedValueOnce(new Error("Workspace not available"));
  await expect(readSiteContextBrief(site, id, id)).rejects.toThrow("Workspace");
  expect(m.rpc).not.toHaveBeenCalled();
});
it("excludes private files, customer assertions and raw lyrics", async () => {
  snapshot.brief.documents.push(
    {
      ...doc,
      topic: "artwork_branding",
      sources: [{ versionId: source, url: "https://private.example/file?token=secret" }],
    },
    { ...doc, topic: "song_summary", evidenceKind: "customer_assertion", text: "private" },
    { ...doc, topic: "lyrics", text: "raw lyrics" },
  );
  const context = await readSiteContextBrief(site, id, id);
  expect(context.engine?.documents).toHaveLength(2);
  expect(context.engine?.missingTopics).toContain("artwork_branding");
});

it("joins separate recording and release evidence without conflating identities", async () => {
  const legacy = JSON.parse(doc.text);
  const { release, ...recording } = legacy;
  snapshot.brief.documents = [
    { ...doc, topic: "recording_metadata", text: JSON.stringify(recording) },
    { ...doc, topic: "release_metadata", text: JSON.stringify(release) },
  ];
  const context = await readSiteContextBrief(site, id, id);
  expect(context.release.title).toBe("Hate U");
  expect(context.release.artists).toEqual(["chillpill"]);
  expect(context.release.date).toBe("2021-06-25");
});

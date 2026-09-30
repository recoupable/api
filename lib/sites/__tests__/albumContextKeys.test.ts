import { expect, it, vi } from "vitest";
import { prepareSiteContext } from "../production/prepareSiteContext";
import { saveSiteContextBrief } from "../production/saveSiteContextBrief";
import type { Site } from "../schema";
const m = vi.hoisted(() => ({ operation: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/context/processContextOperation", () => ({ processContextOperation: m.operation }));
vi.mock("@/lib/context/runStoredContextRequest", () => ({ runStoredContextRequest: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: m.rpc }));
vi.mock("../authorizeSiteWorkspace", () => ({ authorizeSiteWorkspace: vi.fn() }));
vi.mock("../production/readSiteContextBrief", () => ({ readSiteContextBrief: vi.fn() }));
const requestId = "11111111-1111-4111-8111-111111111111";
const otherRequest = "22222222-2222-4222-8222-222222222222";
it("isolates recording ingest keys while preserving existing single-song keys", async () => {
  m.operation.mockResolvedValue({ request: { id: requestId } });
  m.rpc.mockResolvedValue([
    {
      topic: "recording_metadata",
      subjectId: requestId,
      text: JSON.stringify({
        trackId: "a",
        title: "Song",
        isrc: "ISRC",
        durationSeconds: 120,
        artists: [],
      }),
    },
    { topic: "release_metadata", subjectId: otherRequest, text: JSON.stringify({ artwork: [] }) },
  ]);
  const site = {
    id: "site",
    owner_id: "owner",
    release_url: "https://open.spotify.com/track/a",
  } as Site;
  await prepareSiteContext(site, "actor", true);
  await prepareSiteContext(
    { ...site, release_url: "https://open.spotify.com/track/b" },
    "actor",
    true,
  );
  await prepareSiteContext(site, "actor");
  expect(m.operation.mock.calls.slice(-3).map(call => call[1].idempotency_key)).toEqual([
    "sites:site:track:a:context-v1",
    "sites:site:track:b:context-v1",
    "sites:site:context-v1",
  ]);
});
it("saves distinct briefs for different tracks in the same site revision", async () => {
  m.operation.mockResolvedValue({ snapshot: { id: requestId } });
  const site = { id: "site", revision: 1 } as Site;
  await saveSiteContextBrief(site, "actor", { requestId } as Awaited<
    ReturnType<typeof prepareSiteContext>
  >);
  await saveSiteContextBrief(site, "actor", { requestId: otherRequest } as Awaited<
    ReturnType<typeof prepareSiteContext>
  >);
  const keys = m.operation.mock.calls.slice(-2).map(call => call[1].idempotency_key);
  expect(keys[0]).not.toBe(keys[1]);
});

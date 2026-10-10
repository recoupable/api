import { expect, it, vi } from "vitest";
import { compileContextBrief } from "../compileContextBrief";
import { planStoredContextModules } from "../planning/planStoredContextModules";
import type { ContextBriefDocument } from "../selectContextDocuments";

const { authorize, rpc, targets } = vi.hoisted(() => ({
  authorize: vi.fn(),
  rpc: vi.fn(),
  targets: vi.fn(),
}));
vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: authorize }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: rpc }));
vi.mock("@/lib/supabase/context_requests/listContextRequestTargets", () => ({
  listContextRequestTargets: targets,
}));

const actor = "00000000-0000-4000-8000-000000000001";
const owner = "00000000-0000-4000-8000-000000000002";
const songRequest = "00000000-0000-4000-8000-000000000003";
const videoRequest = "00000000-0000-4000-8000-000000000004";
const recording = "00000000-0000-4000-8000-000000000005";
const video = "00000000-0000-4000-8000-000000000006";

const document = (
  id: string,
  subjectId: string,
  topic: string,
  evidenceKind: ContextBriefDocument["evidenceKind"],
  text: string,
): ContextBriefDocument => ({
  id,
  ownerId: owner,
  subjectId,
  topic,
  version: 1,
  status: "accepted",
  evidenceKind,
  text,
  sourceVersionIds: [`${id}-source`],
  coverage: "partial",
});

it("does not plan or dispatch collection for a saved video locator", async () => {
  authorize.mockResolvedValue({ ownerId: owner });
  rpc.mockResolvedValue({
    id: videoRequest,
    owner_id: owner,
    status: "partial",
    input: {
      kind: "video",
      url: "https://www.youtube.com/watch?v=AbCdEfGhI_1",
      videoId: "AbCdEfGhI_1",
      identityConfirmed: false,
    },
  });
  await expect(planStoredContextModules(actor, owner, videoRequest)).rejects.toThrow(
    "Unsupported saved context entry",
  );
  expect(targets).not.toHaveBeenCalled();
});

it.each(["creative_direction", "playlist_pitch", "company_onboarding"] as const)(
  "keeps a video locator out of song and artist evidence in a %s brief",
  purpose => {
    const lyrics = document("lyrics", recording, "lyrics", "observation", "Observed song lyrics.");
    const locator = document(
      "locator",
      video,
      "video_locator",
      "customer_assertion",
      "Submitted video URL; uploader, recording match and captions unresolved.",
    );
    const brief = compileContextBrief({
      ownerId: owner,
      requests: [
        { id: songRequest, subjectIds: [recording] },
        { id: videoRequest, subjectIds: [video] },
      ],
      documents: [lyrics, locator],
      purpose,
      maxCharacters: 8000,
    });
    expect(brief.documents.map(doc => doc.topic)).not.toContain("video_locator");
    expect(brief.text).not.toContain("Submitted video URL");
    expect(brief.input_manifest.excludedTopics).toContain("video_locator");
    const videoCoverage = brief.request_coverage.find(item => item.requestId === videoRequest);
    expect(videoCoverage?.readiness).toBe("partial");
  },
);

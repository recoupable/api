import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
import {
  contextBriefResponseSchema,
  contextBriefSnapshotSchema,
} from "../contracts/contextBriefResponseSchemas";
vi.mock("../authorizeContextOwner", () => ({
  authorizeContextOwner: vi.fn(async (ownerId: string) => ({ ownerId })),
}));
const owner = "11111111-1111-4111-8111-111111111111";
const request = "22222222-2222-4222-8222-222222222222";
const subject = "33333333-3333-4333-8333-333333333333";
const documentId = "44444444-4444-4444-8444-444444444444";
const resultId = "55555555-5555-4555-8555-555555555555";
const source = "66666666-6666-4666-8666-666666666666";
const snapshotId = "77777777-7777-4777-8777-777777777777";
const date = "2026-10-20T12:00:00.000Z";
const fixture = () => {
  let saved: unknown;
  const dispatch = vi.fn();
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "read_context_request")
      return {
        id: request,
        owner_id: owner,
        status: "completed",
        output: { subjectIds: [subject] },
      };
    if (name === "read_context_documents")
      return [
        {
          id: documentId,
          resultId,
          ownerId: owner,
          subjectId: subject,
          topic: "song_summary",
          version: 1,
          status: "accepted",
          evidenceKind: "observation",
          coverage: "partial",
          text: "Quiet piano; interpretation remains tentative.",
          sourceVersionIds: [source],
          sources: [
            { versionId: source, url: "https://private.example.test/evidence", retrievedAt: date },
          ],
        },
      ];
    if (name === "save_context_brief")
      return (saved = {
        id: snapshotId,
        state: "saved",
        superseded: false,
        purpose: "playlist_pitch",
        created_at: date,
        brief: args.p_snapshot,
      });
    if (name === "read_context_brief") return saved;
    throw new Error(`Unexpected operation ${name}`);
  });
  return {
    rpc,
    dispatch,
    setSaved(value: unknown) {
      saved = value;
    },
  };
};
const input = { request_id: request, purpose: "playlist_pitch" };

it("validates real compile/save/read outputs without changing the exact storage document manifest", async () => {
  const deps = fixture();
  const compiled = await processContextOperation(owner, { action: "brief", ...input }, deps);
  const brief = contextBriefResponseSchema.parse(compiled);
  expect(brief.input_manifest).toMatchObject({
    compilerVersion: "context-brief-v1",
    freshness: {
      oldestRetrievedAt: date,
      newestRetrievedAt: date,
      documentsWithoutRetrievalDate: [],
      documents: [{ documentId, oldestRetrievedAt: date, newestRetrievedAt: date }],
    },
  });
  expect(brief.input_manifest.documents).toEqual([
    {
      documentId,
      resultId,
      subjectId: subject,
      topic: "song_summary",
      version: 1,
      sourceVersionIds: [source],
    },
  ]);
  expect(brief.text).toContain(`Retrieved: ${date}`);
  expect(brief.text).toContain("Included evidence: 1 document.");
  expect(JSON.stringify(brief.input_manifest)).not.toContain("private.example.test");
  const saved = await processContextOperation(
    owner,
    { action: "save_brief", ...input, idempotency_key: "freshness-contract" },
    deps,
  );
  expect(contextBriefSnapshotSchema.parse(saved)).toEqual(saved);
  const reopened = await processContextOperation(
    owner,
    { action: "read_brief", brief_id: snapshotId },
    deps,
  );
  expect(contextBriefSnapshotSchema.parse(reopened)).toEqual(saved);
  expect(deps.dispatch).not.toHaveBeenCalled();
});

it("reads legacy snapshots with no freshness without inventing dates or recompiling", async () => {
  const deps = fixture();
  const compiled = (await processContextOperation(owner, { action: "brief", ...input }, deps)) as {
    input_manifest: Record<string, unknown>;
  };
  delete compiled.input_manifest.freshness;
  const saved = {
    id: snapshotId,
    state: "saved",
    superseded: false,
    purpose: "playlist_pitch",
    created_at: date,
    brief: compiled,
  };
  deps.setSaved(saved);
  deps.rpc.mockClear();
  const reopened = await processContextOperation(
    owner,
    { action: "read_brief", brief_id: snapshotId },
    deps,
  );
  expect(contextBriefSnapshotSchema.parse(reopened)).toEqual({ snapshot: saved });
  expect(deps.rpc).toHaveBeenCalledExactlyOnceWith("read_context_brief", {
    p_owner: owner,
    p_brief: snapshotId,
  });
});

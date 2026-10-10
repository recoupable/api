import { describe, expect, it, vi } from "vitest";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
import { processDocumentHistoryOperation } from "../processDocumentHistoryOperation";
import { contextToolOperations } from "@/lib/mcp/oauth/contextToolOperations";
// Isolate module initialization from hosted Supabase credentials; tests inject authorization.
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const document = "33333333-3333-4333-8333-333333333333";
const firstResult = "44444444-4444-4444-8444-444444444444";
const secondResult = "55555555-5555-4555-8555-555555555555";
const history = {
  document: {
    id: document,
    subject_id: "66666666-6666-4666-8666-666666666666",
    topic: "release_metadata",
    current_revision: 3,
    current_result_id: null,
    updated_at: "2026-10-10T12:00:00+00:00",
  },
  versions: [
    {
      revision: 3,
      result_id: null,
      change: "cleared",
      backfilled: false,
      recorded_at: "2026-10-10T12:00:00+00:00",
      result_status: null,
      evidence_kind: null,
      source_version_ids: [],
      source_state: null,
    },
    {
      revision: 2,
      result_id: secondResult,
      change: "accepted",
      backfilled: false,
      recorded_at: "2026-10-10T11:00:00+00:00",
      result_status: "withdrawn",
      evidence_kind: "observation",
      source_version_ids: ["77777777-7777-4777-8777-777777777777"],
      source_state: "withdrawn",
    },
    {
      revision: 1,
      result_id: firstResult,
      change: "accepted",
      backfilled: true,
      recorded_at: "2026-09-21T10:00:00+00:00",
      result_status: "withdrawn",
      evidence_kind: "observation",
      source_version_ids: ["77777777-7777-4777-8777-777777777777"],
      source_state: "withdrawn",
    },
  ],
  has_more: false,
  next_before: null,
};
const authorize = () =>
  vi.fn(async () => ({ accountId: actor, ownerId: owner, organizationId: owner }));
describe("document version history", () => {
  it("reads scoped lineage through the shared operation with bounded defaults", async () => {
    const rpc = vi.fn(async () => history);
    const dispatch = vi.fn();
    const authorized = authorize();
    expect(
      await processContextOperation(
        actor,
        { action: "read_document_history", document_id: document, organization_id: owner },
        { rpc, dispatch, authorize: authorized },
      ),
    ).toEqual({ state: "found", ...history });
    expect(authorized).toHaveBeenCalledWith(actor, owner);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("read_context_document_history", {
      p_owner: owner,
      p_document: document,
      p_before: null,
      p_limit: 50,
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("passes the exclusive revision cursor and page bound to the scoped read", async () => {
    const rpc = vi.fn(async () => ({ ...history, versions: [history.versions[2]] }));
    await processContextOperation(
      actor,
      { action: "read_document_history", document_id: document, before_revision: 2, limit: 1 },
      { rpc, dispatch: vi.fn(), authorize: authorize() },
    );
    expect(rpc).toHaveBeenCalledExactlyOnceWith("read_context_document_history", {
      p_owner: owner,
      p_document: document,
      p_before: 2,
      p_limit: 1,
    });
  });
  it("reports another workspace's or an unknown document as not found without a lineage leak", async () => {
    const rpc = vi.fn(async () => null);
    expect(
      await processDocumentHistoryOperation(
        owner,
        { action: "read_document_history", document_id: document, limit: 50 },
        rpc,
      ),
    ).toEqual({
      state: "not_found",
      document: null,
      versions: [],
      has_more: false,
      next_before: null,
    });
  });
  it("keeps cleared, withdrawn and backfilled versions distinct in the typed result", async () => {
    const result = await processDocumentHistoryOperation(
      owner,
      { action: "read_document_history", document_id: document, limit: 50 },
      vi.fn(async () => history),
    );
    if (result.state !== "found") throw new Error("expected lineage");
    expect(result.document.current_result_id).toBeNull();
    expect(result.versions.map(version => [version.change, version.source_state])).toEqual([
      ["cleared", null],
      ["accepted", "withdrawn"],
      ["accepted", "withdrawn"],
    ]);
    expect(result.versions[2].backfilled).toBe(true);
    expect(result.versions[1].result_id).toBe(secondResult);
  });
  it("does not read on revoked access", async () => {
    const rpc = vi.fn();
    await expect(
      processContextOperation(
        actor,
        { action: "read_document_history", document_id: document, organization_id: owner },
        {
          rpc,
          dispatch: vi.fn(),
          authorize: vi.fn(async () => {
            throw new Error("Access denied");
          }),
        },
      ),
    ).rejects.toThrow("Access denied");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects caller identity, unbounded pages and cursors the API never returns", () => {
    const valid = { action: "read_document_history", document_id: document };
    expect(contextOperationSchema.parse(valid)).toEqual({ ...valid, limit: 50 });
    expect(contextOperationSchema.parse({ ...valid, before_revision: 1 })).toEqual({
      ...valid,
      before_revision: 1,
      limit: 50,
    });
    for (const changes of [
      { account_id: actor },
      { owner_id: owner },
      { limit: 0 },
      { limit: 101 },
      { limit: 1.5 },
      { before_revision: -1 },
      { before_revision: 0 },
      { document_id: "not-a-document" },
    ]) {
      const parsed = contextOperationSchema.safeParse({ ...valid, ...changes });
      expect(parsed.success).toBe(false);
      const key = Object.keys(changes)[0];
      const issue = parsed.error?.issues[0];
      if (key === "account_id" || key === "owner_id")
        expect(issue).toMatchObject({ code: "unrecognized_keys", keys: [key] });
      else expect(issue?.path).toEqual([key]);
    }
  });
  it("is exposed as a read-only standard MCP operation", () => {
    expect(contextToolOperations.read_document_history).toEqual({
      name: "read_music_context_document_history",
      description: expect.stringContaining("revision"),
      readOnly: true,
    });
  });
});

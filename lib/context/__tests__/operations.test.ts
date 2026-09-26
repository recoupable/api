import { describe, expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({
  authorizeContextOwner: vi.fn(async (id: string) => ({
    accountId: id,
    ownerId: id,
    organizationId: null,
  })),
}));
const actor = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
describe("shared context operations", () => {
  it("canonicalizes tracking URLs and equivalent topic ordering for retries", async () => {
    const rpc = vi.fn(async () => ({ id: requestId, status: "queued" }));
    const dispatch = vi.fn();
    for (const suffix of ["?si=first", "?si=second"])
      await processContextOperation(
        actor,
        {
          action: "ingest",
          url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB" + suffix,
          idempotency_key: "same",
          topics: ["release_metadata"],
        },
        { rpc, dispatch },
      );
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(dispatch).toHaveBeenCalledWith(actor, actor, requestId);
  });
  it("does not redispatch completed requests", async () => {
    const dispatch = vi.fn();
    await processContextOperation(
      actor,
      {
        action: "ingest",
        url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB",
        idempotency_key: "same",
      },
      { rpc: vi.fn(async () => ({ id: requestId, status: "completed" })), dispatch },
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("reports missing analysis rather than presenting metadata as a ready creative brief", async () => {
    const rpc = vi.fn(async (name: string) =>
      name === "read_context_request"
        ? {
            id: requestId,
            owner_id: actor,
            status: "completed",
            output: { subjectIds: ["subject"] },
          }
        : [
            {
              id: "doc",
              ownerId: actor,
              subjectId: "subject",
              topic: "release_metadata",
              version: 1,
              status: "accepted",
              evidenceKind: "observation",
              text: "Song title",
              sourceVersionIds: ["source"],
              coverage: "partial",
            },
          ],
    );
    const brief = await processContextOperation(
      actor,
      { action: "brief", request_id: requestId, purpose: "creative_direction" },
      { rpc, dispatch: vi.fn() },
    );
    expect(brief).toMatchObject({
      readiness: "partial",
      missingTopics: expect.arrayContaining(["lyrics", "song_summary", "artwork_branding"]),
    });
  });
  it("keeps a brief partial when every topic exists but audio is a preview", async () => {
    const topics = [
      "song_summary",
      "lyrics",
      "artwork_branding",
      "artist_research",
      "release_metadata",
      "artist_metadata",
    ];
    const rpc = vi.fn(async (name: string) =>
      name === "read_context_request"
        ? {
            id: requestId,
            owner_id: actor,
            status: "completed",
            output: { subjectIds: ["subject"], gaps: [{ topic: "lyrics", status: "unavailable" }] },
          }
        : topics.map(topic => ({
            id: topic,
            ownerId: actor,
            subjectId: "subject",
            topic,
            version: 1,
            status: "accepted",
            evidenceKind: "interpretation",
            text: "Evidence",
            sourceVersionIds: ["source"],
            coverage: topic === "lyrics" ? "partial" : "full",
          })),
    );
    const brief = await processContextOperation(
      actor,
      { action: "brief", request_id: requestId, purpose: "creative_direction" },
      { rpc, dispatch: vi.fn() },
    );
    expect(brief).toMatchObject({
      readiness: "partial",
      missingTopics: [],
      gaps: [{ topic: "lyrics", status: "partial" }],
    });
  });
  it("rejects caller supplied ownership", async () => {
    await expect(
      processContextOperation(
        actor,
        { action: "read", request_id: requestId, account_id: actor },
        { rpc: vi.fn(), dispatch: vi.fn() },
      ),
    ).rejects.toThrow();
  });
  it("combines authorized requests without recollection or duplicate request reads", async () => {
    const second = "33333333-3333-4333-8333-333333333333";
    const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
      expect(params.p_owner).toBe(actor);
      return name === "read_context_request"
        ? {
            id: params.p_request,
            owner_id: actor,
            status: "completed",
            output: { subjectIds: [String(params.p_request)] },
          }
        : [
            {
              id: String(params.p_request),
              ownerId: actor,
              subjectId: String(params.p_request),
              topic: "song_summary",
              version: 1,
              status: "accepted",
              evidenceKind: "observation",
              text: "Saved song analysis",
              sourceVersionIds: ["source"],
              coverage: "partial",
            },
          ];
    });
    const dispatch = vi.fn();
    const brief = await processContextOperation(
      actor,
      {
        action: "brief",
        request_id: requestId,
        additional_request_ids: [second, requestId, second],
        purpose: "playlist_pitch",
      },
      { rpc, dispatch },
    );
    expect(brief).toMatchObject({
      request_ids: [requestId, second],
      documents: [{ subjectId: requestId }, { subjectId: second }],
    });
    expect(rpc.mock.calls.filter(([name]) => name === "read_context_request")).toHaveLength(2);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it.each(["wrong_owner", "cancelled"])(
    "rejects an additional request that is %s",
    async reason => {
      const second = "33333333-3333-4333-8333-333333333333";
      const rpc = vi.fn(async (name: string, params: Record<string, unknown>) =>
        name === "read_context_request"
          ? {
              id: params.p_request,
              owner_id: params.p_request === second && reason === "wrong_owner" ? second : actor,
              status:
                params.p_request === second && reason === "cancelled" ? "cancelled" : "completed",
              output: { subjectIds: ["subject"] },
            }
          : [],
      );
      await expect(
        processContextOperation(
          actor,
          {
            action: "brief",
            request_id: requestId,
            additional_request_ids: [second],
            purpose: "playlist_pitch",
          },
          { rpc, dispatch: vi.fn() },
        ),
      ).rejects.toThrow();
    },
  );
});

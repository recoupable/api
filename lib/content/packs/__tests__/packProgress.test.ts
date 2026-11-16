import { describe, expect, it, vi } from "vitest";
import { readPackSnapshot } from "../readPackSnapshot";
import { prepareReleasePackSchema } from "../releasePackSchema";
import type { PackAsset, PackSnapshot } from "../packTypes";
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(async () => "https://storage.example/signed"),
}));
const timestamp = "2026-10-26T12:00:00Z";
const input = prepareReleasePackSchema.parse({
  idempotency_key: "progress-fixture",
  brief: {
    artist_name: "Artist",
    song_title: "Song",
    audio_url: "https://example.com/song.wav",
    occasion: "new_release",
    allow_creative_defaults: true,
  },
  deliverables: { artwork: 1, carousels: 1, videos: 0, quote_cards: 0, visualizers: 0 },
});
function asset(overrides: Partial<PackAsset> = {}): PackAsset {
  return {
    id: "asset-1",
    job_id: "job-1",
    kind: "artwork",
    ordinal: 0,
    status: "completed",
    attempt: 1,
    completed_at: timestamp,
    credits: 1,
    maximum_usd: 0.01,
    provider_state: {},
    files: [{ storage_key: "owner/release-packs/art.png", content_type: "image/png", bytes: 10 }],
    caption: "Caption",
    qa: { passed: true },
    error: null,
    ...overrides,
  };
}
function snapshot(assets: PackAsset[], job: Record<string, unknown> = {}): PackSnapshot {
  return {
    job: {
      id: "job-1",
      owner_id: "owner",
      created_by: "owner",
      revision: 1,
      status: "running",
      brief: input.brief,
      deliverables: input.deliverables,
      quote: null,
      held_credits: 0,
      consumed_credits: 0,
      workflow_run_id: null,
      error: null,
      ...job,
    },
    assets,
  };
}
describe("pack progress readback", () => {
  it("does not attribute an earlier rejected asset milestone to a later usable asset", async () => {
    const invalid = asset({ caption: " ", completed_at: timestamp });
    const valid = asset({ id: "asset-2", kind: "carousel", completed_at: "2026-10-26T12:01:00Z" });
    const result = await readPackSnapshot(
      snapshot([invalid, valid], { first_usable_asset_at: timestamp }),
    );
    expect(result.progress.counts.usable_pieces).toBe(1);
    expect(result.progress.milestones.first_usable_asset_at).toBeNull();
  });

  it("prefers the final failed inspection over a stale staged receipt", async () => {
    const result = await readPackSnapshot(
      snapshot([
        asset({
          status: "failed",
          qa: { passed: false },
          provider_state: { inspection: { passed: true } },
        }),
      ]),
    );
    expect(result.progress.counts.qa_passed_pieces).toBe(0);
  });

  it("counts the full requested scope before estimates and keeps unmeasured timing null", async () => {
    const result = await readPackSnapshot(
      snapshot([], { status: "ready_to_quote", created_at: timestamp }),
    );
    expect(result).toHaveProperty("progress");
    const p = result.progress;
    expect(p.counts).toMatchObject({
      requested_pieces: 2,
      requested_files: 5,
      generated_pieces: 0,
      generated_files: 0,
      qa_passed_pieces: 0,
      usable_pieces: 0,
    });
    expect(p.milestones.intent_at).toBe(timestamp);
    expect(p.timings).toEqual({
      user_wait_ms: null,
      provider_render_ms: null,
      active_processing_ms: null,
      remaining_ms: null,
    });
  });
  it("separates generated, rejected and usable outputs without declaring partial completion", async () => {
    const result = await readPackSnapshot(
      snapshot(
        [
          asset(),
          asset({
            id: "asset-2",
            kind: "carousel",
            status: "failed",
            qa: { passed: false },
            files: [
              {
                storage_key: "owner/release-packs/rejected.png",
                content_type: "image/png",
                bytes: 10,
              },
            ],
          }),
        ],
        { status: "partial", first_usable_asset_at: timestamp, completed_at: timestamp },
      ),
    );
    const p = result.progress;
    expect(p.counts).toMatchObject({
      generated_pieces: 2,
      generated_files: 2,
      qa_passed_pieces: 1,
      usable_pieces: 1,
      failed_pieces: 1,
    });
    expect(p.complete).toBe(false);
    expect(p.milestones).toMatchObject({
      first_usable_asset_at: timestamp,
      full_pack_completed_at: null,
    });
    expect(p.blockers).toContainEqual({ code: "asset_failed", asset_id: "asset-2" });
  });
  it("never treats failed QA, missing files or blank captions as activation", async () => {
    for (const invalid of [
      asset({ qa: { passed: false } }),
      asset({ files: [] }),
      asset({ caption: "  " }),
    ]) {
      const result = await readPackSnapshot(
        snapshot([invalid], {
          status: "completed",
          first_usable_asset_at: timestamp,
          completed_at: timestamp,
        }),
      );
      expect(result.assets[0].usable).toBe(false);
      expect(result.progress.milestones.first_usable_asset_at).toBeNull();
      expect(result.progress.complete).toBe(false);
    }
  });
  it("uses unique asset and file identities, not retry attempts or a retry quote's subset", async () => {
    const a = asset({ attempt: 3 });
    const source = snapshot([a, a], {
      quote: { creative_piece_count: 1, generated_file_count: 1 },
    });
    const original = structuredClone(source);
    const p = (await readPackSnapshot(source)).progress;
    expect(p.counts).toMatchObject({
      requested_pieces: 2,
      requested_files: 5,
      generated_pieces: 1,
      generated_files: 1,
      usable_pieces: 1,
    });
    expect(source).toEqual(original);
  });
  it("reports staged composition and inspection without exposing receipt contents", async () => {
    const a = asset({
      status: "running",
      files: [],
      caption: null,
      qa: null,
      provider_state: {
        composition: { files: asset().files },
        inspection: { passed: true, reason: "private" },
        caption: "private",
        images: ["https://private.example"],
        image_submission: { request_id: "private-token" },
      },
    });
    const p = (await readPackSnapshot(snapshot([a]))).progress;
    expect(p.counts).toMatchObject({
      generated_pieces: 1,
      generated_files: 1,
      qa_passed_pieces: 1,
      usable_pieces: 0,
      running_pieces: 1,
    });
    expect(p.running_asset_ids).toEqual([a.id]);
    expect(JSON.stringify(p)).not.toContain("private");
    expect(p.milestones.first_usable_asset_at).toBeNull();
  });
  it("reports uncertain dispatch, approval and missing input as explicit blockers", async () => {
    for (const [job, code] of [
      [{ status: "awaiting_approval" }, "approval_required"],
      [
        { status: "needs_input", brief: { ...input.brief, audio_url: undefined } },
        "brief_incomplete",
      ],
      [{ status: "running", dispatch_state: "uncertain" }, "dispatch_uncertain"],
    ] as const) {
      const p = (await readPackSnapshot(snapshot([], job))).progress;
      expect(p.blockers).toContainEqual({ code });
    }
    const p = ((await readPackSnapshot(snapshot([asset({ status: "uncertain" })]))) as any)
      .progress;
    expect(p.blockers).toContainEqual({ code: "asset_uncertain", asset_id: "asset-1" });
  });
  it("exposes successful completion and last export only with saved evidence", async () => {
    const a = asset();
    const p = (
      (await readPackSnapshot(
        snapshot([a], {
          deliverables: { ...input.deliverables, carousels: 0 },
          status: "completed",
          completed_at: timestamp,
          exported_at: timestamp,
        }),
      )) as any
    ).progress;
    expect(p.complete).toBe(true);
    expect(p.milestones).toMatchObject({
      full_pack_completed_at: timestamp,
      last_exported_at: timestamp,
      first_usable_asset_at: null,
    });
    expect(p.blockers).toEqual([]);
  });
});

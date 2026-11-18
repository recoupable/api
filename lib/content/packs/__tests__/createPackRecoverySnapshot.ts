import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
import type { PackAsset, PackSnapshot } from "../packTypes";
export function createPackRecoverySnapshot(): PackSnapshot {
  const brief = releasePackBriefSchema.parse({
    artist_name: "Fixture",
    song_title: "Song",
    occasion: "rediscovery",
    audio_url: "https://example.invalid/song.wav",
    allow_creative_defaults: true,
  });
  const deliverables = releasePackDeliverablesSchema.parse({
    videos: 0,
    artwork: 1,
    quote_cards: 0,
    carousels: 0,
    visualizers: 0,
  });
  const { model_readiness: _assessment, ...quote } = buildReleasePackQuote(brief, deliverables);
  const asset: PackAsset = {
    id: "asset",
    job_id: "job",
    attempt: 1,
    credits: 73,
    maximum_usd: 0.0073,
    files: [],
    caption: null,
    qa: null,
    error: null,
    kind: "artwork",
    ordinal: 0,
    status: "uncertain",
    provider_state: {
      image_submission_0: {
        state: "accepted",
        request_id: "retained",
        model: "original-image-route",
        charge_credits: 73,
        input_sha256: "original-input",
      },
      caption: "Retained caption",
    },
  };
  const saved: PackSnapshot = {
    job: {
      id: "job",
      owner_id: "owner",
      created_by: "owner",
      workflow_run_id: "saved-workflow",
      error: null,
      revision: 1,
      status: "running",
      held_credits: 73,
      consumed_credits: 0,
      brief,
      deliverables,
      quote: {
        ...quote,
        id: "quote",
        revision: 1,
        expires_at: "2099-01-01T00:00:00Z",
        fingerprint: "original-approved-fingerprint",
      },
      production_context: {
        state: "complete",
        audio: { storage_key: "owner/release-packs/song.wav" },
        references: [],
        summary: "Sparse piano and percussion",
        visual_direction: "Cream paper and ink",
        proposed_start_seconds: 0,
        selected_start_seconds: 0,
        duration_seconds: 30,
      },
    },
    assets: [asset],
  };
  return saved;
}

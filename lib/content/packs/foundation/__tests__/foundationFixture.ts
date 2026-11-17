import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../../releasePackSchema";
import { buildReleasePackQuote } from "../../buildReleasePackQuote";
import type { PackSnapshot } from "../../packTypes";
export function foundationFixture(artwork = 1): PackSnapshot {
  const brief = releasePackBriefSchema.parse({
    artist_name: "Fixture",
    song_title: "Song",
    creative_direction: "Blue paper",
    audio_url: "https://example.com/audio.mp3",
  });
  const deliverables = releasePackDeliverablesSchema.parse({
    artwork,
    videos: 1,
    quote_cards: 1,
    carousels: 0,
    visualizers: 0,
  });
  const quote = {
    ...buildReleasePackQuote(brief, deliverables),
    id: "quote",
    revision: 1,
    expires_at: "2099-01-01T00:00:00Z",
  };
  return {
    job: {
      id: "job",
      owner_id: "owner",
      created_by: "owner",
      revision: 1,
      status: "running",
      brief,
      deliverables,
      quote,
      held_credits: quote.credits,
      consumed_credits: 0,
      workflow_run_id: "run",
      error: null,
      production_context: { state: "complete", summary: "Retained audio" },
    },
    assets: quote.assets.map(a => ({
      ...a,
      id: `${a.kind}-${a.ordinal}`,
      job_id: "job",
      status: "pending",
      attempt: 0,
      files: [],
      provider_state: {},
      caption: null,
      qa: null,
      error: null,
    })),
  };
}

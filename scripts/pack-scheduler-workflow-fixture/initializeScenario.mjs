import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
export async function initializeScenario(effects, scenario) {
  await mkdir(effects);
  const assets = Array.from({ length: 5 }, (_, i) => ({
    id: `asset-${i}`,
    job_id: scenario,
    kind: "quote_card",
    ordinal: i,
    status: i === 4 ? "completed" : "pending",
    attempt: 0,
    credits: 10,
    maximum_usd: 1,
    caption: null,
    qa: null,
    error: null,
    provider_state: {},
    files: i === 4 ? [{ storage_key: "retained", content_type: "image/png", bytes: 10 }] : [],
  }));
  await writeFile(join(effects, "events.jsonl"), "");
  await writeFile(
    join(effects, "state.json"),
    JSON.stringify({
      scenario,
      settlements: 0,
      assets,
      job: {
        id: scenario,
        owner_id: "fixture-owner",
        created_by: "fixture-owner",
        revision: 1,
        status: "running",
        quote: null,
        consumed_credits: 0,
        workflow_run_id: null,
        error: null,
        held_credits: 100,
        brief: {
          primary_action: "listen",
          allow_creative_defaults: true,
          reference_image_urls: [],
          platforms: ["instagram"],
          evidence: [],
          artist_name: "Fixture",
          song_title: "Song",
          constraints: [],
          audio_url: "https://fixture.invalid/audio",
        },
        deliverables: {
          videos: 0,
          quote_cards: 5,
          artwork: 0,
          carousels: 0,
          visualizers: 0,
          video_seconds: 8,
        },
        production_context: {
          state: "complete",
          summary: "retained analysis",
          source_sha256: "a".repeat(64),
        },
      },
    }),
  );
}

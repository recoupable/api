import { selectSongMeasurements } from "@/lib/supabase/song_measurements/selectSongMeasurements";

const ATTEMPTS = 15;
const INTERVAL_MS = 6000;

/**
 * Polls the measurement store until the snapshot has at least one captured song
 * (value what lands, like the marketing valuation), or the ~90s bound elapses.
 * `sleep` is injected for tests.
 *
 * @returns true once a measurement lands, false if the bound elapses first.
 */
export async function waitForSnapshotMeasurements(
  snapshotId: string,
  sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)),
): Promise<boolean> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    await sleep(INTERVAL_MS);
    const measurements = await selectSongMeasurements({
      snapshot: snapshotId,
      limit: 1,
    });
    if (measurements.length > 0) return true;
  }
  return false;
}

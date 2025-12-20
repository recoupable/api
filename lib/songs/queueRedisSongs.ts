import { SongWithSpotify } from "./getSongsByIsrc";
import { songsIsrcQueue, SongsIsrcJobData } from "@/lib/redis/songsQueue";

/**
 * Queues songs ISRCs to Redis for background processing
 *
 * @param songs - Array of songs with Spotify data
 * @returns A promise that resolves when all jobs are queued
 */
export async function queueRedisSongs(songs: SongWithSpotify[]): Promise<void> {
  if (songs.length === 0) return;

  // Queue each ISRC to Redis for background processing
  const queuePromises = songs.map(async song => {
    if (!song.isrc) return;

    const jobData: SongsIsrcJobData = {
      isrc: song.isrc,
    };

    try {
      await songsIsrcQueue.add(`process-isrc-${song.isrc}`, jobData, {
        jobId: `isrc-${song.isrc}`, // Unique job ID to prevent duplicates
        priority: 1, // Higher priority for ISRC processing
      });
    } catch (error) {
      console.error(`[Queue] Failed to queue ISRC job for ${song.isrc}:`, error);
    }
  });

  // Wait for all jobs to be queued
  await Promise.allSettled(queuePromises);
}

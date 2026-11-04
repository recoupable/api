import { SONG_MOMENTS_MEASURE_URL } from "@/lib/const";
import { getModalProxyAuthHeaders } from "@/lib/flamingo/getModalProxyAuthHeaders";
import { isMeasuredSong, type MeasuredSong } from "@/lib/songMoments/isMeasuredSong";

/**
 * Calls the song-moments /measure endpoint on Modal, which finds the song's
 * sections, moments and cuts from the audio itself (no language model).
 *
 * @param params - The audio and, optionally, the lyric sheet's section order.
 * @returns The measured song.
 * @throws Error if the Modal endpoint returns a non-OK status or an unexpected shape.
 */
export async function callMeasureSongMoments(params: {
  audio_url: string;
  section_order?: string[];
}): Promise<MeasuredSong> {
  const response = await fetch(SONG_MOMENTS_MEASURE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getModalProxyAuthHeaders() },
    body: JSON.stringify({
      audio_url: params.audio_url,
      section_order: params.section_order ?? null,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(`Song measurement returned ${response.status}: ${errorText}`);
    throw new Error(`Song measurement failed (status ${response.status})`);
  }

  const data = await response.json();
  if (!isMeasuredSong(data)) {
    throw new Error("Song measurement returned an unexpected response shape");
  }
  return data;
}

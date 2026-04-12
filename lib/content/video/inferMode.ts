/**
 * Infers the video generation mode from the inputs when the caller doesn't specify one.
 *
 * @param v - Object with optional media URL fields.
 * @returns The inferred mode string.
 */
export function inferMode(v: {
  audio_url?: string;
  video_url?: string;
  image_url?: string;
  end_image_url?: string;
}): string {
  if (v.audio_url && v.image_url) return "lipsync";
  if (v.video_url) return "extend";
  if (v.image_url && v.end_image_url) return "first-last";
  if (v.image_url) return "animate";
  return "prompt";
}

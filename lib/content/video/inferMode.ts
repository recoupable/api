/**
 * Infer Mode.
 *
 * @param v - Value for v.
 * @param v.audio_url - Value for v.audio_url.
 * @param v.video_url - Value for v.video_url.
 * @param v.image_url - Value for v.image_url.
 * @param v.end_image_url - Value for v.end_image_url.
 * @returns - Computed result.
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

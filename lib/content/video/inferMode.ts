/**
 * Infer Mode.
 *
 * @param v - Parameter.
 * @param v.audio_url - Parameter.
 * @param v.video_url - Parameter.
 * @param v.image_url - Parameter.
 * @param v.end_image_url - Parameter.
 * @returns - Result.
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

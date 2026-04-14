/**
 * Build Fal Input.
 *
 * @param mode - Parameter.
 * @param v - Parameter.
 * @param v.prompt - Parameter.
 * @param v.negative_prompt - Parameter.
 * @param v.image_url - Parameter.
 * @param v.end_image_url - Parameter.
 * @param v.video_url - Parameter.
 * @param v.audio_url - Parameter.
 * @param v.aspect_ratio - Parameter.
 * @param v.duration - Parameter.
 * @param v.resolution - Parameter.
 * @param v.generate_audio - Parameter.
 * @returns - Result.
 */
export function buildFalInput(
  mode: string,
  v: {
    prompt?: string;
    negative_prompt?: string;
    image_url?: string;
    end_image_url?: string;
    video_url?: string;
    audio_url?: string;
    aspect_ratio: string;
    duration: string;
    resolution: string;
    generate_audio: boolean;
  },
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: v.prompt ?? "",
    aspect_ratio: v.aspect_ratio,
    duration: v.duration,
    resolution: v.resolution,
    generate_audio: v.generate_audio,
    safety_tolerance: "6",
    auto_fix: true,
  };

  if (v.negative_prompt) input.negative_prompt = v.negative_prompt;

  if (mode === "reference" && v.image_url) {
    input.image_urls = [v.image_url];
  } else if (mode === "first-last" && v.image_url) {
    input.first_frame_url = v.image_url;
    if (v.end_image_url) input.last_frame_url = v.end_image_url;
  } else if (v.image_url) {
    input.image_url = v.image_url;
  }

  if (v.video_url) input.video_url = v.video_url;
  if (v.audio_url) input.audio_url = v.audio_url;

  return input;
}

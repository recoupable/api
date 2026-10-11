import { getLipsyncFrameCount } from "./getLipsyncFrameCount";
import type { ValidatedCreateLipsyncBody } from "./validateCreateLipsyncBody";
import { LIPSYNC_FPS, LIPSYNC_HEIGHT, LIPSYNC_WIDTH } from "./constants";

/** Bound output frames independently of uploaded audio length and preserve its conditioning. */
export function buildLipsyncInput(
  body: Omit<ValidatedCreateLipsyncBody, "accountId">,
): Record<string, unknown> {
  return {
    prompt: body.prompt,
    image_url: body.image_url,
    audio_url: body.audio_url,
    match_audio_length: false,
    // LTX temporal dimensions use 8k+1 frames. Never let a full-song upload
    // silently turn a 15-second preset into an unbounded paid generation.
    num_frames: getLipsyncFrameCount(body.duration),
    fps: LIPSYNC_FPS,
    video_size: { width: LIPSYNC_WIDTH, height: LIPSYNC_HEIGHT },
    audio_strength: 1,
    preprocess_audio: false,
    enable_safety_checker: true,
    ...(body.seed !== undefined && { seed: body.seed }),
  };
}

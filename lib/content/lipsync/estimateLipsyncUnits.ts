import { getLipsyncFrameCount } from "./getLipsyncFrameCount";
import { LIPSYNC_HEIGHT, LIPSYNC_WIDTH } from "./constants";

/** Rounded output megapixels for the fixed resolution and 8k+1 frame count. */
export function estimateLipsyncUnits(duration: number): number {
  const frames = getLipsyncFrameCount(duration);
  return Math.ceil((LIPSYNC_WIDTH * LIPSYNC_HEIGHT * frames) / 1_000_000);
}

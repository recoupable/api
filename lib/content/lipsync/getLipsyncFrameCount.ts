import { LIPSYNC_FPS } from "./constants";

/** Fixed LTX output uses an 8k+1 temporal shape, rounded above the requested seconds. */
export function getLipsyncFrameCount(duration: number): number {
  return Math.ceil((duration * LIPSYNC_FPS) / 8) * 8 + 1;
}

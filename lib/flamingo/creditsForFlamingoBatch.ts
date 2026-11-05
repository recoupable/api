import { creditsForFlamingoCall } from "@/lib/flamingo/creditsForFlamingoCall";

/**
 * Credits for one batch of prompts on one audio file: a single five-cent
 * base (`FLAMINGO_BASE_CREDITS`), however many prompts the batch carries,
 * plus $0.001166 per second of the whole batch. The batch is one Modal
 * request with one container start and one audio download, so it owes the
 * base once; that is the saving over one call per prompt.
 *
 * Priced exactly as one model call of the batch's total length, so it
 * delegates to `creditsForFlamingoCall` (which also prices a non-positive or
 * non-finite duration at the base).
 *
 * @param totalSeconds - The batch's total `elapsed_seconds` from Modal.
 * @returns Whole credits, never below `FLAMINGO_BASE_CREDITS`.
 */
export function creditsForFlamingoBatch(totalSeconds: number): number {
  return creditsForFlamingoCall(totalSeconds);
}

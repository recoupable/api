/**
 * Post-processing utilities for Music Flamingo preset responses.
 * These fix common model output issues like repetition loops
 * and Python-style single-quoted JSON.
 */
export { parseJsonLike } from "./parseJsonLike";
export { condenseRepetitions } from "./condenseRepetitions";
export { extractOneCycle } from "./extractOneCycle";
export { deduplicateArray } from "./deduplicateArray";

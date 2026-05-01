export const CAPTION_LENGTHS = ["none", "short", "medium", "long"] as const;
export type CaptionLength = (typeof CAPTION_LENGTHS)[number];

export const DSP_VALUES = ["none", "spotify", "apple"] as const;
export type DspValue = (typeof DSP_VALUES)[number];

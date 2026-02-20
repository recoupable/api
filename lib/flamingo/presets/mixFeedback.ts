import type { PresetConfig } from "./types";

/** Technical mix engineer feedback — frequency balance, dynamics, stereo field. */
export const mixFeedbackPreset: PresetConfig = {
  name: "mix_feedback",
  label: "Mix Feedback",
  description:
    "Technical mix engineer critique — frequency balance, dynamics, stereo field, and specific processing suggestions.",
  prompt: `I already know what this song sounds like. I need a MIX ENGINEER's critique ONLY. Do not describe the genre, lyrics, mood, or song structure. Focus exclusively on the technical quality of the mix. Answer ONLY these questions: 1) Is the low end clean or muddy? Is the kick cutting through? Is the sub controlled? 2) Are the vocals sitting properly in the mid-range or are they fighting with other elements? Any boxy buildup around 300-500Hz? 3) Is there enough air above 10kHz? Any harshness in the 2-5kHz range? Sibilance issues? 4) How wide is the stereo image? Would this collapse in mono? 5) Is the dynamic range healthy or is it over-compressed? 6) What specific EQ, compression, or spatial processing would you change? List concrete fixes.`,
  params: { max_new_tokens: 1024, temperature: 0.4, do_sample: true },
  requiresAudio: true,
  responseFormat: "text",
};

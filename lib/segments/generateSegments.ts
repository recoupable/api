import generateArray from "@/lib/ai/generateArray";
import { SEGMENT_SYSTEM_PROMPT } from "./consts";
import getAnalysisPrompt from "./getAnalysisPrompt";
import type { SocialFanWithDetails } from "@/lib/supabase/social_fans/selectSocialFans";

export interface GenerateSegmentsParams {
  fans: SocialFanWithDetails[];
  prompt: string;
}

export interface GenerateArrayResult {
  segmentName: string;
  fans: string[];
}

export const generateSegments = async ({
  fans,
  prompt,
}: GenerateSegmentsParams): Promise<GenerateArrayResult[]> => {
  try {
    const analysisPrompt = getAnalysisPrompt({ fans, prompt });

    const result = await generateArray({
      system: SEGMENT_SYSTEM_PROMPT,
      prompt: analysisPrompt,
    });

    return result;
  } catch (error) {
    console.error("Error generating segments:", error);
    throw new Error("Failed to generate segments from fan data");
  }
};

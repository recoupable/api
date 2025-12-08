import {
  generateVideo as openAIGenerateVideo,
  type GenerateVideoResponse,
} from "@/lib/openai/generateVideo";
import { getOpenAIErrorMessage } from "@/lib/openai/getOpenAIErrorMessage";
import type { GenerateVideoQuery } from "./validateGenerateVideoQuery";

export interface VideoGenerationResult extends GenerateVideoResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Generates a video from a text prompt using OpenAI's Sora 2 model.
 *
 * @param input - The input parameters for video generation
 * @returns The video generation result
 */
export async function generateVideoFunction(
  input: GenerateVideoQuery,
): Promise<VideoGenerationResult> {
  try {
    const { prompt, seconds = 8, size = "720x1280" } = input;

    const data = await openAIGenerateVideo({
      model: "sora-2",
      prompt,
      seconds,
      size,
    });

    return {
      success: true,
      id: data.id,
      object: data.object,
      model: data.model,
      status: data.status,
      progress: data.progress,
      created_at: data.created_at,
      size: data.size,
      seconds: data.seconds,
      quality: data.quality,
      message:
        data.status === "completed"
          ? `Video successfully generated: ${data.seconds}s at ${data.size} resolution.`
          : `Video generation job created. Status: ${data.status}. Use the video ID to check progress and retrieve the video when complete.`,
    };
  } catch (error) {
    console.error("Error generating video:", error);

    const errorMessage = getOpenAIErrorMessage(error);

    return {
      success: false,
      id: "",
      object: "video",
      model: "sora-2",
      status: "failed",
      size: input.size || "720x1280",
      seconds: (input.seconds || 8).toString(),
      error: errorMessage,
      message: "Failed to generate video. " + errorMessage,
    };
  }
}

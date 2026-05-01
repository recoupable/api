import { retrieveVideo as openAIRetrieveVideo } from "@/lib/openai/retrieveVideo";
import { type GenerateVideoResponse } from "@/lib/openai/generateVideo";
import { getOpenAIErrorMessage } from "@/lib/openai/getOpenAIErrorMessage";
import type { RetrieveVideoQuery } from "./validateRetrieveVideoQuery";

export interface RetrieveVideoResult extends GenerateVideoResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Retrieves the status and details of a video generation job.
 *
 * @param input - The input parameters containing the video ID
 * @returns The video retrieval result
 */
export async function retrieveVideoFunction(
  input: RetrieveVideoQuery,
): Promise<RetrieveVideoResult> {
  try {
    const data = await openAIRetrieveVideo(input.video_id);

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
          ? `Video generation complete!`
          : data.status === "processing"
            ? `Video is still processing. Progress: ${data.progress || 0}%`
            : data.status === "queued"
              ? `Video generation is queued. Please check back shortly.`
              : `Video status: ${data.status}`,
    };
  } catch (error) {
    console.error("Error retrieving video:", error);

    const errorMessage = getOpenAIErrorMessage(error);

    return {
      success: false,
      id: input.video_id,
      object: "video",
      model: "sora-2",
      status: "failed",
      size: "",
      seconds: "",
      error: errorMessage,
      message: "Failed to retrieve video. " + errorMessage,
    };
  }
}

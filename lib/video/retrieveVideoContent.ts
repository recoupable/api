import { retrieveVideoContent as openAIRetrieveVideoContent } from "@/lib/openai/retrieveVideoContent";
import { getOpenAIErrorMessage } from "@/lib/openai/getOpenAIErrorMessage";
import type { RetrieveVideoQuery } from "./validateRetrieveVideoQuery";

export interface RetrieveVideoContentResult {
  success: boolean;
  video_id: string;
  videoUrl?: string;
  contentType: string;
  size: number;
  sizeInMB: string;
  message?: string;
  error?: string;
}

/**
 * Downloads and retrieves the rendered video content for a completed video generation job.
 *
 * @param input - The input parameters containing the video ID
 * @returns The video content retrieval result
 */
export async function retrieveVideoContentFunction(
  input: RetrieveVideoQuery,
): Promise<RetrieveVideoContentResult> {
  try {
    const data = await openAIRetrieveVideoContent(input.video_id);

    const sizeInMB = (data.size / (1024 * 1024)).toFixed(2);

    return {
      success: true,
      video_id: input.video_id,
      videoUrl: data.dataUrl,
      contentType: data.contentType,
      size: data.size,
      sizeInMB: `${sizeInMB} MB`,
      message: `Video content downloaded successfully. File size: ${sizeInMB} MB, Content type: ${data.contentType}`,
    };
  } catch (error) {
    console.error("Error retrieving video content:", error);

    const errorMessage = getOpenAIErrorMessage(error);

    return {
      success: false,
      video_id: input.video_id,
      contentType: "",
      size: 0,
      sizeInMB: "0 MB",
      error: errorMessage,
      message: "Failed to retrieve video content. " + errorMessage,
    };
  }
}

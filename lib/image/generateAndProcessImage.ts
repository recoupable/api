import generateImage from "@/lib/ai/generateImage";
import { uploadImageAndCreateMoment } from "@/lib/arweave/uploadImageAndCreateMoment";
import type { FilePart } from "ai";

export interface GenerateAndProcessImageResult {
  imageUrl: string | null;
}

export interface FileInput {
  url: string;
  type: string;
}

/**
 * Generates an image and processes it (uploads to Arweave).
 *
 * @param prompt - The text prompt describing the image to generate
 * @param accountId - The account ID
 * @param files - Optional array of file inputs for image editing
 * @returns The Arweave URL of the generated/processed image
 */
export async function generateAndProcessImage(
  prompt: string,
  accountId: string,
  files?: FileInput[],
): Promise<GenerateAndProcessImageResult> {
  if (!prompt) {
    throw new Error("Prompt is required");
  }

  if (!accountId) {
    throw new Error("Account ID is required");
  }

  // Convert FileInput to FilePart format if files are provided
  const fileParts: FilePart[] | undefined = files?.map(file => ({
    type: "file" as const,
    data: file.url,
    mediaType: file.type,
  }));

  // Generate the image
  const result = await generateImage(prompt, fileParts);

  if (!result) {
    throw new Error("Failed to generate image");
  }

  // Upload to Arweave and create moment
  const { imageUrl } = await uploadImageAndCreateMoment({
    image: result.image,
    prompt,
    account: accountId,
  });

  return {
    imageUrl,
  };
}

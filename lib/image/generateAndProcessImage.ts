import generateImage from "@/lib/ai/generateImage";
import { uploadImageAndCreateMoment } from "@/lib/image/uploadImageAndCreateMoment";
import type { FilePart } from "ai";

export interface GenerateAndProcessImageResult {
  imageUrl: string | null;
}

export interface FileInput {
  url: string;
  type: string;
}

/**
 * Generates an image and stores it in public media storage.
 *
 * @param prompt - The text prompt describing the image to generate
 * @param accountId - The account ID
 * @param files - Optional array of file inputs for image editing
 * @returns The durable URL of the generated/processed image
 */
export async function generateAndProcessImage(
  prompt: string,
  accountId: string,
  files?: FileInput[],
  uploaderAccountId?: string,
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

  // Store public media and preserve the existing best-effort moment behavior.
  const { imageUrl } = await uploadImageAndCreateMoment({
    image: result.image,
    prompt,
    account: accountId,
    uploaderAccountId,
  });

  return {
    imageUrl,
  };
}

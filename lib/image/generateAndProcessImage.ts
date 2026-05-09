import generateImage from "@/lib/ai/generateImage";
import { uploadPublicAsset } from "@/lib/files/uploadPublicAsset";
import { createImageMoment } from "@/lib/inprocess/createImageMoment";
import type { FilePart } from "ai";

export interface GenerateAndProcessImageResult {
  imageUrl: string | null;
}

export interface FileInput {
  url: string;
  type: string;
}

/**
 * Generates an image, uploads it to the public-uploads Supabase bucket, and
 * (best-effort) creates a moment on the In Process protocol if the account
 * is set. Moment-creation failures are swallowed so they don't block the
 * caller, which only needs the image URL.
 *
 * @param prompt - The text prompt describing the image to generate
 * @param accountId - The account ID
 * @param files - Optional array of file inputs for image editing
 * @returns The URL of the uploaded generated image
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

  const result = await generateImage(prompt, fileParts);
  if (!result) {
    throw new Error("Failed to generate image");
  }

  const { url: imageUrl } = await uploadPublicAsset({
    data: Buffer.from(result.image.base64, "base64"),
    contentType: result.image.mediaType,
  });

  try {
    await createImageMoment({
      prompt,
      account: accountId,
      imageUri: imageUrl,
      mediaType: result.image.mediaType,
    });
  } catch (momentError) {
    console.error("Error creating moment:", momentError);
  }

  return { imageUrl };
}

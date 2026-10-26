import { uploadPublicAsset } from "@/lib/files/uploadPublicAsset";
import { createImageMoment } from "@/lib/inprocess/createImageMoment";
import { GeneratedFile } from "ai";

export interface UploadImageAndCreateMomentParams {
  image: GeneratedFile;
  prompt: string;
  account: string | null;
  uploaderAccountId?: string;
}

export interface UploadImageAndCreateMomentResult {
  /** Deprecated: storage no longer produces blockchain transactions. */
  arweaveResult: null;
  imageUrl: string | null;
  moment: unknown | null;
  /** Deprecated alias of uploadError. */
  arweaveError: string | null;
  uploadError: string | null;
}

/**
 * Stores an image in public storage and creates a moment if account is provided.
 * Handles errors gracefully and returns partial results if any step fails.
 *
 * @param params - Parameters for uploading image and creating moment.
 * @returns Result object with upload and moment creation data, or error information.
 */
export async function uploadImageAndCreateMoment(
  params: UploadImageAndCreateMomentParams,
): Promise<UploadImageAndCreateMomentResult> {
  const { image, prompt, account, uploaderAccountId } = params;

  let imageUrl: string | null = null;
  let momentResult: unknown | null = null;
  let uploadError: string | null = null;

  try {
    const { url } = await uploadPublicAsset({
      data: Buffer.from(image.base64, "base64"),
      contentType: image.mediaType,
      uploaderAccountId,
    });
    imageUrl = url;
    // Try to create moment if account is provided, but don't fail if it errors.
    if (account) {
      try {
        momentResult = await createImageMoment({
          prompt,
          account,
          imageUri: imageUrl,
          uploaderAccountId,
          mediaType: image.mediaType,
        });
      } catch (momentError) {
        console.error("Error creating moment:", momentError);
        // Continue without moment.
      }
    }
  } catch (error) {
    console.error("Error storing generated image:", error);
    uploadError = "Could not store generated image";
    // Keep the existing partial-result contract.
  }

  return {
    arweaveResult: null,
    imageUrl,
    moment: momentResult,
    uploadError,
    arweaveError: uploadError,
  };
}

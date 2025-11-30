import uploadImageToArweave from "./uploadImageToArweave";
import { getFetchableUrl } from "./getFetchableUrl";
import { createImageMoment } from "@/lib/inprocess/createImageMoment";
import Transaction from "arweave/node/lib/transaction";
import { GeneratedFile } from "ai";

export interface UploadImageAndCreateMomentParams {
  image: GeneratedFile;
  prompt: string;
  account: string | null;
}

export interface UploadImageAndCreateMomentResult {
  arweaveResult: Transaction | null;
  imageUrl: string | null;
  moment: unknown | null;
  arweaveError: string | null;
}

/**
 * Uploads an image to Arweave and creates a moment if account is provided.
 * Handles errors gracefully and returns partial results if any step fails.
 *
 * @param params - Parameters for uploading image and creating moment.
 * @returns Result object with upload and moment creation data, or error information.
 */
export async function uploadImageAndCreateMoment(
  params: UploadImageAndCreateMomentParams,
): Promise<UploadImageAndCreateMomentResult> {
  const { image, prompt, account } = params;

  let arweaveResult: Transaction | null = null;
  let imageUrl: string | null = null;
  let momentResult: unknown | null = null;
  let arweaveError: string | null = null;

  try {
    arweaveResult = await uploadImageToArweave({
      base64Data: image.base64,
      mimeType: image.mediaType,
    });

    if (arweaveResult) {
      const arweaveUri = `ar://${arweaveResult.id}`;
      imageUrl = getFetchableUrl(arweaveUri);

      // Try to create moment if account is provided, but don't fail if it errors
      if (account) {
        try {
          momentResult = await createImageMoment({
            prompt,
            account,
            arweaveUri,
            mediaType: image.mediaType,
          });
        } catch (momentError) {
          console.error("Error creating moment:", momentError);
          // Continue without moment
        }
      }
    }
  } catch (error) {
    console.error("Error uploading to Arweave:", error);
    arweaveError = error instanceof Error ? error.message : "Unknown Arweave error";
    // Continue without Arweave upload
  }

  return {
    arweaveResult,
    imageUrl,
    moment: momentResult,
    arweaveError,
  };
}

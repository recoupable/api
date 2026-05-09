import { GeneratedFile } from "ai";
import { uploadPublicAsset } from "@/lib/files/uploadPublicAsset";
import { createImageMoment } from "@/lib/inprocess/createImageMoment";

export interface UploadImageAndCreateMomentParams {
  image: GeneratedFile;
  prompt: string;
  account: string | null;
}

export interface UploadImageAndCreateMomentResult {
  imageUrl: string | null;
  moment: unknown | null;
  uploadError: string | null;
}

/**
 * Uploads a generated image to the public-uploads Supabase bucket and
 * (optionally) creates a moment on the In Process protocol when an account
 * is provided. Errors are handled gracefully so partial results can still be
 * returned.
 *
 * @param params - The image to upload, the prompt that produced it, and the
 *   account address used for moment creation (or `null` to skip moment).
 * @returns Upload result with `imageUrl`, optional `moment`, and `uploadError`
 *   if the upload itself failed.
 */
export async function uploadImageAndCreateMoment(
  params: UploadImageAndCreateMomentParams,
): Promise<UploadImageAndCreateMomentResult> {
  const { image, prompt, account } = params;

  let imageUrl: string | null = null;
  let momentResult: unknown | null = null;
  let uploadError: string | null = null;

  try {
    const buffer = Buffer.from(image.base64, "base64");
    const { url } = await uploadPublicAsset({
      data: buffer,
      contentType: image.mediaType,
    });
    imageUrl = url;

    if (account) {
      try {
        momentResult = await createImageMoment({
          prompt,
          account,
          imageUri: imageUrl,
          mediaType: image.mediaType,
        });
      } catch (momentError) {
        console.error("Error creating moment:", momentError);
      }
    }
  } catch (error) {
    console.error("Error uploading image:", error);
    uploadError = error instanceof Error ? error.message : "Unknown upload error";
  }

  return {
    imageUrl,
    moment: momentResult,
    uploadError,
  };
}

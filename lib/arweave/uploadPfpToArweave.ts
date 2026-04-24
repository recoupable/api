import { getBlob } from "@/lib/ipfs/getBlob";
import uploadImageToArweave from "./uploadImageToArweave";

/**
 * Downloads a profile picture and uploads it to Arweave.
 *
 * @param image - HTTPS URL of the profile picture.
 * @returns The Arweave gateway URL of the uploaded image, or null on failure.
 */
export async function uploadPfpToArweave(image: string): Promise<string | null> {
  try {
    const { blob, type } = await getBlob(image);
    const base64Data = Buffer.from(await blob.arrayBuffer()).toString("base64");

    const transaction = await uploadImageToArweave({
      base64Data,
      mimeType: type || "image/png",
    });

    if (!transaction?.id) {
      return null;
    }

    return `https://arweave.net/${transaction.id}`;
  } catch (error) {
    console.error("[ERROR] uploadPfpToArweave:", error);
    return null;
  }
}

import Transaction from "arweave/node/lib/transaction";
import { uploadToArweave as uploadDataToArweave } from "./uploadToArweave";

/**
 * Uploads image data to Arweave.
 *
 * @param imageData - The image data with base64 content and MIME type.
 * @param imageData.base64Data - Base64-encoded image data.
 * @param imageData.mimeType - MIME type of the image.
 * @param getProgress - Optional callback to track upload progress.
 * @returns Promise resolving to the Arweave transaction.
 */
const uploadImageToArweave = async (
  imageData: { base64Data: string; mimeType: string },
  getProgress: (progress: number) => void = () => {},
): Promise<Transaction> => {
  const buffer = Buffer.from(imageData.base64Data, "base64");
  return uploadDataToArweave(buffer, imageData.mimeType, getProgress);
};

export default uploadImageToArweave;

import { uploadToArweave } from "./uploadToArweave";

/**
 * Uploads text content to Arweave as a text/plain file.
 *
 * @param text - The text content to upload
 * @returns The Arweave URL (ar://...)
 */
export async function uploadTextToArweave(text: string): Promise<string> {
  const textBuffer = Buffer.from(text, "utf-8");
  const transaction = await uploadToArweave(textBuffer, "text/plain");
  return `ar://${transaction.id}`;
}

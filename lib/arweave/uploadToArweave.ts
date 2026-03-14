import Transaction from "arweave/node/lib/transaction";
import { arweave, ARWEAVE_KEY } from "./client";

/**
 * Uploads data to Arweave.
 *
 * @param data - The data buffer to upload.
 * @param contentType - The content type (MIME type) for the data.
 * @param getProgress - Optional callback to track upload progress.
 * @returns Promise resolving to the Arweave transaction.
 */
export async function uploadToArweave(
  data: Buffer,
  contentType: string,
  getProgress: (progress: number) => void = () => {},
): Promise<Transaction> {
  const transaction = await arweave.createTransaction(
    {
      data,
    },
    ARWEAVE_KEY,
  );
  transaction.addTag("Content-Type", contentType);
  await arweave.transactions.sign(transaction, ARWEAVE_KEY);
  const uploader = await arweave.transactions.getUploader(transaction);

  while (!uploader.isComplete) {
    console.log(
      `${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`,
    );
    getProgress(uploader.pctComplete);
    await uploader.uploadChunk();
  }

  return transaction;
}

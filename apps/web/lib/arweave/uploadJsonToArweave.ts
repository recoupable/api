import Transaction from "arweave/node/lib/transaction";
import { uploadToArweave } from "./uploadToArweave";

/**
 * Uploads JSON data to Arweave.
 *
 * @param jsonData - The JSON object to upload.
 * @returns Promise resolving to the Arweave transaction.
 */
const uploadJsonToArweave = async (jsonData: unknown): Promise<Transaction> => {
  const jsonString = JSON.stringify(jsonData);
  const buffer = Buffer.from(jsonString, "utf-8");
  return uploadToArweave(buffer, "application/json");
};

export default uploadJsonToArweave;

import { uploadTextToArweave } from "@/lib/arweave/uploadTextToArweave";
import uploadJsonToArweave from "@/lib/arweave/uploadJsonToArweave";

export interface GeneratedTxtResponse {
  txt: {
    base64Data: string;
    mimeType: string;
  };
  arweave?: string | null;
  metadataArweave?: string | null;
}

/**
 * Generates and stores a TXT file by uploading it to Arweave.
 * Creates both the text file and metadata JSON on Arweave.
 *
 * @param contents - The text contents to store
 * @returns The generated TXT response with Arweave URLs
 */
export async function generateAndStoreTxtFile(contents: string): Promise<GeneratedTxtResponse> {
  if (!contents) {
    throw new Error("Contents are required");
  }

  const mimeType = "text/plain";

  // Upload the TXT file to Arweave
  let txtFile: string | null = null;
  try {
    txtFile = await uploadTextToArweave(contents);
  } catch (arweaveError) {
    console.error("Error uploading TXT to Arweave:", arweaveError);
    // Continue even if Arweave upload fails
  }

  const image = "ar://EXwe2peizXKxjUMop6W-JPflC5sWyeQR1y0JiRDwUB0";

  // Upload metadata JSON to Arweave
  let metadataArweave: string | null = null;
  try {
    const transaction = await uploadJsonToArweave({
      image,
      animation_url: txtFile || undefined,
      content: {
        mime: mimeType,
        uri: txtFile || "",
      },
      description: contents,
      name: contents.substring(0, 100), // Limit name length
    });
    metadataArweave = `ar://${transaction.id}`;
  } catch (metadataError) {
    console.error("Error uploading metadata to Arweave:", metadataError);
  }

  // Encode contents to base64 for response
  const base64Data = Buffer.from(contents, "utf-8").toString("base64");

  return {
    txt: {
      base64Data,
      mimeType,
    },
    arweave: txtFile,
    metadataArweave,
  };
}


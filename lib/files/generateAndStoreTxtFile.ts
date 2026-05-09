import { uploadDataToPublicBucket } from "@/lib/files/uploadDataToPublicBucket";

export interface GeneratedTxtResponse {
  txt: {
    base64Data: string;
    mimeType: string;
  };
  txtUrl?: string | null;
  metadataUrl?: string | null;
}

/**
 * Generates and stores a TXT file by uploading it (and a JSON metadata file
 * referencing it) to the public-uploads Supabase bucket. Returns the
 * resulting CDN URLs alongside a base64 encoding of the original text.
 *
 * @param contents - The text contents to store
 * @returns The generated TXT response with public CDN URLs
 */
export async function generateAndStoreTxtFile(contents: string): Promise<GeneratedTxtResponse> {
  if (!contents) {
    throw new Error("Contents are required");
  }

  const mimeType = "text/plain";

  let txtUrl: string | null = null;
  try {
    const result = await uploadDataToPublicBucket({
      data: contents,
      contentType: mimeType,
    });
    txtUrl = result.url;
  } catch (uploadError) {
    console.error("Error uploading TXT to public bucket:", uploadError);
  }

  const image = "ar://EXwe2peizXKxjUMop6W-JPflC5sWyeQR1y0JiRDwUB0";

  let metadataUrl: string | null = null;
  try {
    const result = await uploadDataToPublicBucket({
      data: JSON.stringify({
        image,
        animation_url: txtUrl || undefined,
        content: {
          mime: mimeType,
          uri: txtUrl || "",
        },
        description: contents,
        name: contents.substring(0, 100),
      }),
      contentType: "application/json",
    });
    metadataUrl = result.url;
  } catch (metadataError) {
    console.error("Error uploading metadata to public bucket:", metadataError);
  }

  const base64Data = Buffer.from(contents, "utf-8").toString("base64");

  return {
    txt: {
      base64Data,
      mimeType,
    },
    txtUrl,
    metadataUrl,
  };
}

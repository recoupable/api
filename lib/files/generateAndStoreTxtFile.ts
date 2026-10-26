import { uploadPublicAsset } from "./uploadPublicAsset";

export interface GeneratedTxtResponse {
  txt: { base64Data: string; mimeType: string };
  txtUrl: string;
  metadataUrl: string | null;
  /** Deprecated compatibility aliases; these are HTTPS URLs, not transactions. */
  arweave: string;
  metadataArweave: string | null;
}

/** Store text publicly, preserving old response aliases while clients migrate. */
export async function generateAndStoreTxtFile(
  contents: string,
  uploaderAccountId?: string,
): Promise<GeneratedTxtResponse> {
  if (!contents) throw new Error("Contents are required");
  const mimeType = "text/plain";
  const { url: txtUrl } = await uploadPublicAsset({
    data: contents,
    contentType: mimeType,
    uploaderAccountId,
  });
  let metadataUrl: string | null = null;
  try {
    const result = await uploadPublicAsset({
      data: JSON.stringify({
        image: "ar://EXwe2peizXKxjUMop6W-JPflC5sWyeQR1y0JiRDwUB0",
        animation_url: txtUrl,
        content: { mime: mimeType, uri: txtUrl },
        description: contents,
        name: contents.substring(0, 100),
      }),
      contentType: "application/json",
      uploaderAccountId,
    });
    metadataUrl = result.url;
  } catch (error) {
    console.error("Could not store TXT metadata:", error);
  }
  return {
    txt: { base64Data: Buffer.from(contents).toString("base64"), mimeType },
    txtUrl,
    metadataUrl,
    arweave: txtUrl,
    metadataArweave: metadataUrl,
  };
}

import { uploadDataToPublicBucket } from "@/lib/files/uploadDataToPublicBucket";
import { createMoment, type CreateMomentResponse } from "./createMoment";

export interface CreateImageMomentParams {
  prompt: string;
  account: string;
  imageUri: string;
  mediaType: string;
}

/**
 * Creates a moment on the In Process protocol from an image generation result.
 * Uploads the contract metadata to the public-uploads Supabase bucket and
 * passes the resulting CDN URL to the moment contract.
 *
 * @param params - Parameters for creating the image moment.
 * @returns Promise resolving to the moment creation response, or null if creation fails.
 */
export async function createImageMoment(
  params: CreateImageMomentParams,
): Promise<CreateMomentResponse | null> {
  const { prompt, account, imageUri, mediaType } = params;

  try {
    const contractName = prompt.substring(0, 100);

    const contractMetadata = {
      name: contractName,
      description: prompt,
      image: imageUri,
      animation_url: imageUri,
      content: {
        mime: mediaType,
        uri: imageUri,
      },
    };

    const { url: contractMetadataUri } = await uploadDataToPublicBucket({
      data: JSON.stringify(contractMetadata),
      contentType: "application/json",
      fileExtension: ".json",
    });

    const momentResult = await createMoment({
      contract: {
        name: contractName,
        uri: contractMetadataUri,
      },
      token: {
        tokenMetadataURI: contractMetadataUri,
        createReferral: account,
        salesConfig: {
          type: "fixedPrice",
          pricePerToken: "0",
          saleStart: 0,
          saleEnd: 0,
        },
        mintToCreatorCount: 1,
        payoutRecipient: account,
      },
      account,
    });

    return momentResult;
  } catch (error) {
    console.error("Error creating image moment:", error);
    return null;
  }
}

import uploadJsonToArweave from "@/lib/arweave/uploadJsonToArweave";
import { createMoment, type CreateMomentResponse } from "./createMoment";

export interface CreateImageMomentParams {
  prompt: string;
  account: string;
  arweaveUri: string;
  mediaType: string;
}

/**
 * Creates a moment on the In Process protocol from an image generation result.
 * This includes creating and uploading contract metadata to Arweave.
 *
 * @param params - Parameters for creating the image moment.
 * @returns Promise resolving to the moment creation response, or null if creation fails.
 */
export async function createImageMoment(
  params: CreateImageMomentParams,
): Promise<CreateMomentResponse | null> {
  const { prompt, account, arweaveUri, mediaType } = params;

  try {
    const contractName = prompt.substring(0, 100);

    const contractMetadata = {
      name: contractName,
      description: prompt,
      image: arweaveUri,
      animation_url: arweaveUri,
      content: {
        mime: mediaType,
        uri: arweaveUri,
      },
    };

    const contractMetadataResult = await uploadJsonToArweave(contractMetadata);
    const contractMetadataUri = `ar://${contractMetadataResult.id}`;

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

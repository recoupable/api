/**
 * Creates a moment on the In Process protocol.
 *
 * @param params - Parameters for creating the moment.
 * @returns Promise resolving to the moment creation response.
 */
export interface CreateMomentParams {
  contract: {
    name: string;
    uri: string;
  };
  token: {
    tokenMetadataURI: string;
    createReferral: string;
    salesConfig: {
      type: string;
      pricePerToken: string;
      saleStart: number;
      saleEnd: number;
    };
    mintToCreatorCount: number;
    payoutRecipient?: string;
  };
  splits?: {
    recipients: string[];
    percentAllocations: number[];
  };
  account: string;
}

export interface CreateMomentResponse {
  contractAddress: string;
  tokenId: string;
  hash: string;
}

/**
 * Creates a moment on the In Process protocol.
 *
 * @param params - Parameters for creating the moment.
 * @returns Promise resolving to the moment creation response.
 */
export async function createMoment(params: CreateMomentParams): Promise<CreateMomentResponse> {
  const response = await fetch("https://inprocess.fun/api/moment/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create moment: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return response.json();
}

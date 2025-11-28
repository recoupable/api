import { facilitator } from "@coinbase/x402";
import { Address } from "viem";
import { paymentMiddleware } from "x402-next";

const payTo = process.env.RESOURCE_WALLET_ADDRESS as Address;

const inputSchema = {
  queryParams: {
    prompt: "Text prompt describing the image to generate",
  },
};

// Match the image generation endpoint schema
const imageGenerateOutputSchema = {
  type: "object" as const,
  description: "GenerateImageResult containing the generated images and metadata",
  properties: {
    images: {
      type: "array" as const,
      description: "Array of all generated images",
      items: {
        type: "object" as const,
        description: "Generated image",
        properties: {
          base64: { type: "string", description: "Image as base64 encoded string" },
          mediaType: { type: "string", description: "IANA media type of the image" },
        },
      },
    },
    usage: {
      type: "object" as const,
      description: "Token usage information for the image generation",
    },
    imageUrl: {
      type: "string" as const,
      description: "Fetchable URL for the uploaded image",
    },
    arweaveResult: {
      type: "object" as const,
      description: "Arweave transaction result",
    },
  },
};

export const middleware = paymentMiddleware(
  payTo,
  {
    "GET /api/x402/image/generate": {
      price: "$0.01111",
      network: "base",
      config: {
        discoverable: true, // make endpoint discoverable
        description: "Generate an image from a text prompt using AI",
        outputSchema: imageGenerateOutputSchema,
        inputSchema,
      },
    },
  },
  facilitator,
  {
    appName: "Mainnet x402 Demo",
    appLogo: "/x402-icon-blue.png",
    sessionTokenEndpoint: "/api/x402/session-token",
  },
);

// Configure which paths the middleware should run on
export const config = {
  matcher: ["/protected/:path*", "/api/:path*"],
  runtime: "nodejs",
};

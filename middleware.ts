import { facilitator } from "@coinbase/x402";
import { paymentMiddleware } from "x402-next";
import { IMAGE_GENERATE_PRICE, SMART_ACCOUNT_ADDRESS } from "./lib/const";

const inputSchema = {
  queryParams: {
    prompt: "Text prompt describing the image to generate",
    files:
      "Optional pipe-separated list of files. Format: url1:mediaType1|url2:mediaType2. Example: https://example.com/image.png:image/png|https://example.com/file.jpg:image/jpeg",
  },
};

// Match the image generation endpoint schema
const imageGenerateOutputSchema = {
  type: "object" as const,
  description: "GenerateImageResult containing the generated image and metadata",
  properties: {
    image: {
      type: "object" as const,
      description: "Generated image file",
      properties: {
        base64: { type: "string", description: "Image as base64 encoded string" },
        mediaType: { type: "string", description: "IANA media type of the image" },
      },
    },
    usage: {
      type: "object" as const,
      description: "Token usage information for the image generation",
      properties: {
        inputTokens: { type: "number", description: "Number of tokens used for the prompt" },
        outputTokens: { type: "number", description: "Number of tokens used for the output" },
        totalTokens: { type: "number", description: "Number of tokens used for the total" },
        reasoningTokens: { type: "number", description: "Number of tokens used for the reasoning" },
      },
    },
    imageUrl: {
      type: "string" as const,
      description: "Fetchable URL for the uploaded image (nullable)",
    },
    arweaveResult: {
      type: "object" as const,
      description: "Arweave transaction result (nullable)",
    },
    moment: {
      type: "object" as const,
      description: "In Process moment creation result (nullable)",
    },
    arweaveError: {
      type: "string" as const,
      description: "Error message if Arweave upload failed (optional)",
    },
  },
};

export const middleware = paymentMiddleware(
  SMART_ACCOUNT_ADDRESS,
  {
    "GET /api/x402/image/generate": {
      price: `$${IMAGE_GENERATE_PRICE}`,
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

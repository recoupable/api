import { facilitator } from "@coinbase/x402";
import { paymentMiddleware } from "x402-next";
import { CHAT_PRICE, IMAGE_GENERATE_PRICE, SMART_ACCOUNT_ADDRESS } from "./lib/const";

const imageInputSchema = {
  queryParams: {
    prompt: "Text prompt describing the image to generate",
    files:
      "Optional pipe-separated list of files. Format: url1:mediaType1|url2:mediaType2. Example: https://example.com/image.png:image/png|https://example.com/file.jpg:image/jpeg",
  },
};

const chatInputSchema = {
  bodyType: "json" as const,
  bodyFields: {
    messages:
      "Array of chat messages in the format { role: 'user' | 'assistant', content: string }",
    prompt: "Alternative to messages - a simple string prompt (mutually exclusive with messages)",
    roomId: "Optional UUID of the chat room for conversation continuity",
    artistId: "Optional UUID of the artist account for context",
    accountId: "The account ID of the user making the request",
    model: "Optional model ID override",
    excludeTools: "Optional array of tool names to exclude",
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

// Chat endpoint output schema (streaming response)
const chatOutputSchema = {
  type: "object" as const,
  description: "Streaming chat response with AI-generated messages",
  properties: {
    stream: {
      type: "string" as const,
      description: "Server-sent events stream containing chat messages and tool results",
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
        discoverable: true,
        description: "Generate an image from a text prompt using AI",
        outputSchema: imageGenerateOutputSchema,
        inputSchema: imageInputSchema,
      },
    },
    "POST /api/x402/chat": {
      price: `$${CHAT_PRICE}`,
      network: "base",
      config: {
        discoverable: true,
        description: "Chat with an AI agent that can use tools to help with tasks",
        outputSchema: chatOutputSchema,
        inputSchema: chatInputSchema,
      },
    },
  },
  facilitator,
  {
    appName: "Recoup API",
    appLogo: "/images/recoup_logo.png",
    sessionTokenEndpoint: "/api/x402/session-token",
  },
);

// Configure which paths the middleware should run on
export const config = {
  matcher: ["/protected/:path*", "/api/:path*"],
  runtime: "nodejs",
};

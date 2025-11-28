import { fetchWithPayment } from "../fetchWithPayment";

/**
 * Generates an image using the x402-protected image generation endpoint.
 *
 * @param prompt - The text prompt describing the image to generate.
 * @param baseUrl - The base URL for the API.
 * @returns Promise resolving to the generated image data.
 */
export async function x402GenerateImage(prompt: string, baseUrl: string): Promise<unknown> {
  const x402Url = new URL("/api/x402/image/generate", baseUrl);
  x402Url.searchParams.set("prompt", prompt);

  const response = await fetchWithPayment(x402Url.toString());
  return response.json();
}

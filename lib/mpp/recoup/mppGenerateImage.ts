import { fetchWithMppPayment } from "@/lib/mpp/fetchWithMppPayment";

/**
 * Generates an image using the MPP-protected image generation endpoint.
 *
 * @param prompt - The text prompt describing the image to generate.
 * @param baseUrl - The base URL for the API.
 * @param accountId - The account ID to deduct credits from.
 * @param files - Optional files parameter in format: url1:type1|url2:type2
 * @returns Promise resolving to the generated image data.
 */
export async function mppGenerateImage(
  prompt: string,
  baseUrl: string,
  accountId: string,
  files?: string | null,
): Promise<unknown> {
  const mppUrl = new URL("/api/mpp/image/generate", baseUrl);
  mppUrl.searchParams.set("prompt", prompt);

  if (files) {
    mppUrl.searchParams.set("files", files);
  }

  const response = await fetchWithMppPayment(mppUrl.toString(), accountId);
  return response.json();
}

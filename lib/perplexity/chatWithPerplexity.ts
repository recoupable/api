import { getPerplexityApiKey, getPerplexityHeaders, PERPLEXITY_BASE_URL } from "./config";

export interface PerplexityMessage {
  role: string;
  content: string;
}

export interface ChatResult {
  content: string;
  citations: string[];
  searchResults: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
}

/**
 * Sends a chat completion request to Perplexity API.
 * Uses non-streaming for simpler MCP tool integration.
 *
 * @param messages - Array of messages with role and content
 * @param model - The Perplexity model to use (default: sonar-pro)
 * @returns Chat result with content, citations, and search results
 */
export async function chatWithPerplexity(
  messages: PerplexityMessage[],
  model: string = "sonar-pro",
): Promise<ChatResult> {
  const apiKey = getPerplexityApiKey();
  const url = `${PERPLEXITY_BASE_URL}/chat/completions`;

  const body = {
    model,
    messages,
    stream: false,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: getPerplexityHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();

  const content = data.choices?.[0]?.message?.content || "";
  const citations = data.citations || [];
  const searchResults = data.search_results || [];

  return {
    content,
    citations,
    searchResults,
  };
}

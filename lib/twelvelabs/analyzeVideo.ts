const TWELVELABS_ANALYZE_URL = "https://api.twelvelabs.io/v1.3/analyze";

export interface AnalyzeVideoParams {
  videoUrl: string;
  prompt: string;
  temperature: number;
  maxTokens?: number;
}

export interface AnalyzeVideoResult {
  text: string;
  finishReason: string | null;
  usage: { output_tokens?: number } | null;
}

/**
 * Call the Twelve Labs video analysis API.
 *
 * @param params - Video URL, prompt, temperature, and optional max tokens.
 * @returns Analysis result with text, finish reason, and usage.
 * @throws Error if TWELVELABS_API_KEY is missing or API call fails.
 */
export async function analyzeVideo(params: AnalyzeVideoParams): Promise<AnalyzeVideoResult> {
  const apiKey = process.env.TWELVELABS_API_KEY;
  if (!apiKey) {
    throw new Error("TWELVELABS_API_KEY is not configured");
  }

  const response = await fetch(TWELVELABS_ANALYZE_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      video: { type: "url", url: params.videoUrl },
      prompt: params.prompt,
      temperature: params.temperature,
      stream: false,
      ...(params.maxTokens && { max_tokens: params.maxTokens }),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Twelve Labs analyze error:", response.status, errorBody);
    throw new Error(`Video analysis failed: ${response.status}`);
  }

  const json = (await response.json()) as {
    data?: string;
    finish_reason?: string;
    usage?: { output_tokens?: number };
  };

  if (!json.data) {
    throw new Error("Video analysis returned no text");
  }

  return {
    text: json.data,
    finishReason: json.finish_reason ?? null,
    usage: json.usage ?? null,
  };
}

const TWELVELABS_ANALYZE_URL = "https://api.twelvelabs.io/v1.3/analyze";

export interface AnalyzeVideoResult {
  text: string;
  finishReason: string | null;
  usage: { output_tokens?: number } | null;
}

/**
 * Analyze Video.
 *
 * @param validated - Value for validated.
 * @param validated.video_url - Value for validated.video_url.
 * @param validated.prompt - Value for validated.prompt.
 * @param validated.temperature - Value for validated.temperature.
 * @param validated.max_tokens - Value for validated.max_tokens.
 * @returns - Computed result.
 */
export async function analyzeVideo(validated: {
  video_url: string;
  prompt: string;
  temperature: number;
  max_tokens?: number;
}): Promise<AnalyzeVideoResult> {
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
      video: { type: "url", url: validated.video_url },
      prompt: validated.prompt,
      temperature: validated.temperature,
      stream: false,
      ...(validated.max_tokens && { max_tokens: validated.max_tokens }),
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

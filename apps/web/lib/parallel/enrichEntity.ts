const PARALLEL_BASE_URL = "https://api.parallel.ai/v1";

export interface EnrichResult {
  run_id: string;
  status: string;
  output: unknown;
  citations?: Array<{ url: string; title?: string; field?: string }>;
}

/**
 * Enriches an entity with structured data from web research.
 * Creates a task run and uses the blocking /result endpoint to wait
 * for completion (up to timeout seconds).
 *
 * @param input - What to research (e.g., "Kaash Paige R&B artist")
 * @param outputSchema - JSON schema for the structured output
 * @param processor - Processor tier: "base" (fast), "core" (balanced), "ultra" (deep)
 * @param timeout - Max seconds to wait for result (default 120)
 * @returns The enrichment result with structured output and optional citations.
 */
export async function enrichEntity(
  input: string,
  outputSchema: Record<string, unknown>,
  processor: "base" | "core" | "ultra" = "base",
  timeout: number = 120,
): Promise<EnrichResult> {
  const apiKey = process.env.PARALLEL_API_KEY;

  if (!apiKey) {
    throw new Error("PARALLEL_API_KEY environment variable is not set");
  }

  const createResponse = await fetch(`${PARALLEL_BASE_URL}/tasks/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      input,
      processor,
      task_spec: {
        output_schema: {
          type: "json",
          json_schema: outputSchema,
        },
      },
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Parallel Task API error: ${createResponse.status}\n${errorText}`);
  }

  const taskRun = await createResponse.json();
  const runId = taskRun.run_id;

  if (!runId) {
    throw new Error("Parallel Task API did not return a run_id");
  }

  const resultResponse = await fetch(
    `${PARALLEL_BASE_URL}/tasks/runs/${runId}/result?timeout=${timeout}`,
    { headers: { "x-api-key": apiKey } },
  );

  if (resultResponse.status === 408) {
    return { run_id: runId, status: "timeout", output: null };
  }

  if (resultResponse.status === 404) {
    throw new Error("Task run failed or not found");
  }

  if (!resultResponse.ok) {
    const errorText = await resultResponse.text();
    throw new Error(`Parallel result fetch failed: ${resultResponse.status}\n${errorText}`);
  }

  const resultData = await resultResponse.json();
  const output = resultData.output;

  const citations = (output?.basis || []).flatMap(
    (b: { field?: string; citations?: Array<{ url: string; title?: string }> }) =>
      (b.citations || []).map(c => ({ ...c, field: b.field })),
  );

  return {
    run_id: runId,
    status: "completed",
    output: output?.content,
    citations: citations.length > 0 ? citations : undefined,
  };
}

/** Read bounded UTF-8 JSON without trusting Content-Length or retaining a request reader. */
export async function readIngestionRequestBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("JSON body required");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 3 * 1024 * 1024) throw new Error("Request too large");
      chunks.push(value);
    }
    try {
      return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    } catch {
      throw new Error("Invalid JSON body");
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

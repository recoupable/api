import { FatalError } from "workflow";
/** Read provider JSON with a strict body limit; never retain upstream errors. */
export async function readLuminateBody(
  response: Response,
  limit: number,
  label: string,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new FatalError(`Empty ${label} response`);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new FatalError(`${label} response exceeds size limit`);
    }
    chunks.push(chunk.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new FatalError(`Invalid ${label} response`);
  }
}

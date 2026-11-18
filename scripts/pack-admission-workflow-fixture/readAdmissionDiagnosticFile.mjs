import { open } from "node:fs/promises";
/** Bound allocation and reads before parsing, including partial/growing diagnostic files. */
export async function readAdmissionDiagnosticFile(path, format = "json", byteLimit = 1048576) {
  const file = await open(path, "r");
  try {
    const sourceBytes = (await file.stat()).size;
    const buffer = Buffer.alloc(byteLimit + 1);
    let bytesRead = 0;
    while (bytesRead < buffer.length) {
      const chunk = await file.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
      if (!chunk.bytesRead) break;
      bytesRead += chunk.bytesRead;
    }
    const truncated = bytesRead > byteLimit || sourceBytes > byteLimit;
    const text = buffer.subarray(0, Math.min(bytesRead, byteLimit)).toString("utf8");
    const metadata = { sourceBytes, bytesRead, byteLimit, truncated };
    if (format === "jsonl")
      return {
        ...metadata,
        data: text
          .split("\n")
          .filter(Boolean)
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return { incompleteRawLine: line };
            }
          }),
      };
    if (truncated) return { ...metadata, rawPrefix: text };
    try {
      return { ...metadata, data: JSON.parse(text) };
    } catch (error) {
      return { ...metadata, rawPrefix: text, parseError: error.message };
    }
  } finally {
    await file.close();
  }
}

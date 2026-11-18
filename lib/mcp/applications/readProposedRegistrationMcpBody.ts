import type { createProposedRegistrationMcpLifetime } from "./createProposedRegistrationMcpLifetime";
/** Read once, count wire bytes, and reject non-single or unacknowledged tool execution. */
export async function readProposedRegistrationMcpBody(
  request: Request,
  life: ReturnType<typeof createProposedRegistrationMcpLifetime>,
): Promise<unknown> {
  const fail = (status: number, message: string, code = -32600): never => {
    throw Response.json({ jsonrpc: "2.0", error: { code, message }, id: null }, { status });
  };
  const accept = request.headers.get("accept");
  if (!accept?.includes("application/json") || !accept.includes("text/event-stream"))
    fail(406, "Both JSON and event-stream must be accepted", -32000);
  if (!request.headers.get("content-type")?.includes("application/json"))
    fail(415, "JSON content type required", -32000);
  if (Number(request.headers.get("content-length")) > 65536) fail(413, "Request body too large");
  if (!request.body) fail(400, "Invalid JSON", -32700);
  // No asynchronous gap between checking the owner and registering the acquired reader.
  life.assertActive();
  const reader = request.body!.getReader();
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      reader.releaseLock();
    }
  };
  life.own(async () => {
    if (!released) {
      try {
        await reader.cancel();
      } finally {
        release();
      }
    }
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(Response.json({ error: "Request body timeout" }, { status: 408 })),
      5000,
    );
  });
  try {
    const bytes: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await life.run(() => Promise.race([reader.read(), timeout]));
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 65536) fail(413, "Request body too large");
      bytes.push(chunk.value);
    }
    release();
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of bytes) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined));
    } catch {
      fail(400, "Invalid JSON", -32700);
    }
    if (Array.isArray(body)) fail(400, "Batches are unsupported");
    if (
      body &&
      typeof body === "object" &&
      "method" in body &&
      body.method === "tools/call" &&
      !("id" in body && (typeof body.id === "string" || typeof body.id === "number"))
    )
      fail(400, "Tool calls require an id");
    return body;
  } finally {
    clearTimeout(timer);
  }
}

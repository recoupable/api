/** Guard the adapter's uncaught JSON parse while preserving the original transport body. */
export async function validateMcpJsonBody(request: Request): Promise<{ body: unknown } | Response> {
  // Match mcp-handler's JSON branch; leave other methods/media types to the transport.
  if (
    request.method !== "POST" ||
    !request.headers.get("content-type")?.includes("application/json")
  )
    return { body: undefined };
  try {
    return { body: await request.clone().json() };
  } catch {
    // Preserve the SDK's Accept-before-JSON error precedence even for broken JSON.
    const accept = request.headers.get("accept");
    const acceptable = accept?.includes("application/json") && accept.includes("text/event-stream");
    return Response.json(
      {
        jsonrpc: "2.0",
        error: {
          code: acceptable ? -32700 : -32000,
          message: acceptable
            ? "Parse error: Invalid JSON"
            : "Not Acceptable: Client must accept both application/json and text/event-stream",
        },
        id: null,
      },
      { status: acceptable ? 400 : 406 },
    );
  }
}

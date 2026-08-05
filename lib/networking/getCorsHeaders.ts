/**
 * Get the CORS headers.
 *
 * @returns The CORS headers.
 */
export function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, x-api-key",
    // Browsers hide every non-safelisted response header from cross-origin JS
    // unless it is named here. Without this `x-workflow-run-id` — documented
    // as part of the 200 on the chat endpoints since the workflow cutover —
    // has never been readable by chat.recoupable.dev, and a live read of
    // `x-workflow-stream-tail-index` returns null (chat#1923). The AI SDK's
    // WorkflowChatTransport reads the latter to anchor relative resume
    // positions, so it would fail silently against us today.
    "Access-Control-Expose-Headers": "x-workflow-run-id, x-workflow-stream-tail-index",
  };
}

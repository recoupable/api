import { describe, it, expect } from "vitest";
import { createNothingToResumeResponse } from "@/lib/chat/createNothingToResumeResponse";

async function readAll(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe("createNothingToResumeResponse", () => {
  // A bare 204 does not terminate WorkflowChatTransport's resume loop. The loop
  // exits on a chunk with type "finish" (workflow-chat-transport.js:311); a 204
  // is `ok` and, cross-origin, arrives with a non-null empty body, so it never
  // throws and never finishes — the client re-requests forever (app#2052).
  it("is a 200 stream, not a 204", async () => {
    const res = createNothingToResumeResponse();
    expect(res.status).toBe(200);
    expect(res.body).not.toBeNull();
  });

  it("frames a single finish chunk as SSE the AI SDK can parse", async () => {
    const body = await readAll(createNothingToResumeResponse());

    // Exactly what WorkflowChatTransport's loop needs: one `finish` chunk,
    // then the SDK's stream terminator.
    expect(body).toBe('data: {"type":"finish"}\n\ndata: [DONE]\n\n');
  });

  it("emits exactly one chunk, so a resume adds nothing to the transcript", async () => {
    const body = await readAll(createNothingToResumeResponse());
    const chunks = body
      .split("\n\n")
      .filter(line => line.startsWith("data: ") && !line.includes("[DONE]"));

    expect(chunks).toHaveLength(1);
  });

  it("declares the ui-message-stream content type", () => {
    const res = createNothingToResumeResponse();
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
  });

  it("carries the CORS headers the browser needs cross-origin", () => {
    const res = createNothingToResumeResponse();
    expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
  });
});

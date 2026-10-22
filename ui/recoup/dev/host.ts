import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import { OpenAIMessageParamsSchema } from "@openai/mcp-extensions/app";
import { z } from "zod";
// Local protocol harness only: messages are displayed, never sent to an AI or service.
const query = new URLSearchParams(location.search);
const sidebar = query.get("surface") !== "thread";
const extended = !query.has("standard");
const iframe = document.createElement("iframe");
iframe.title = "Recoup extension";
iframe.style.cssText = "width:100%;height:80vh;border:0";
iframe.sandbox.add("allow-scripts", "allow-forms");
document.body.append(iframe);
const output = document.createElement("pre");
output.id = "received";
output.style.whiteSpace = "pre-wrap";
output.textContent = "Local host harness. No message received.";
document.body.append(output);
const bridge = new AppBridge(
  null,
  { name: "Local test host", version: "1" },
  { message: { text: {} }, ...(extended ? { experimental: { "openai/message": {} } } : {}) },
  {
    hostContext: {
      theme: query.get("theme") === "dark" ? "dark" : "light",
      displayMode: "fullscreen",
      toolInfo: {
        tool: {
          name: sidebar ? "open_recoup_workflows_sidebar" : "open_recoup_workflows",
          inputSchema: { type: "object" },
        },
      },
    },
  },
);
const receive = async ({ content, _meta }: z.infer<typeof OpenAIMessageParamsSchema>) => {
  const delayedFailure = query.has("delayedFailure");
  if (delayedFailure) await new Promise(resolve => setTimeout(resolve, 5000));
  output.textContent =
    `Local protocol test only; native ChatGPT pane layout is not simulated.\nTarget: ${JSON.stringify(_meta?.["openai/message"] ?? { target: "active" })}\nReceived through MCP Apps bridge:\n` +
    content
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("\n");
  return delayedFailure ? { isError: true } : {};
};
if (extended) {
  bridge.setRequestHandler(
    z.object({ method: z.literal("ui/message"), params: OpenAIMessageParamsSchema }),
    async ({ params }) => receive(params),
  );
} else {
  bridge.onmessage = receive;
}
const timer = setTimeout(() => {
  output.textContent =
    "The app did not initialize. Check that preview.html was built and is served from this directory.";
}, 8000);
bridge.oninitialized = () => {
  clearTimeout(timer);
  void bridge.sendToolResult({
    content: [],
    structuredContent: {
      title: "Recoup",
      version: 1,
      messageTarget: sidebar ? "new" : "active",
    },
  });
};
void bridge
  .connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!))
  .then(() => {
    iframe.src = "preview.html";
  })
  .catch(() => {
    clearTimeout(timer);
    output.textContent =
      "The local MCP Apps bridge could not connect. Rebuild the preview and reload.";
  });

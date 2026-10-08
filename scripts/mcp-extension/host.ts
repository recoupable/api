import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
// Local protocol harness only: messages are displayed, never sent to an AI or service.
const iframe = document.createElement("iframe");
iframe.title = "Recoup extension";
iframe.style.cssText = "width:100%;height:80vh;border:0";
iframe.sandbox.add("allow-scripts", "allow-forms", "allow-same-origin");
document.body.append(iframe);
const output = document.createElement("pre");
output.id = "received";
output.style.whiteSpace = "pre-wrap";
output.textContent = "Local host harness — no message received.";
document.body.append(output);
const bridge = new AppBridge(
  null,
  { name: "Local test host", version: "1" },
  { message: { text: {} } },
  { hostContext: { theme: "light", displayMode: "fullscreen" } },
);
bridge.onmessage = async ({ content }) => {
  output.textContent =
    "Received through MCP Apps bridge:\n" +
    content
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("\n");
  return {};
};
bridge.oninitialized = () => {
  void bridge.sendToolResult({ content: [], structuredContent: { title: "Recoup", version: 1 } });
};
void bridge
  .connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!))
  .then(() => {
    iframe.src = "preview.html";
  });

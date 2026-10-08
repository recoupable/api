import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
// Local protocol harness only: messages are displayed, never sent to an AI or service.
const iframe = document.createElement("iframe");
iframe.title = "Recoup extension";
iframe.style.cssText = "width:100%;height:80vh;border:0";
iframe.sandbox.add("allow-scripts", "allow-forms");
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
  {
    hostContext: {
      theme: new URLSearchParams(location.search).get("theme") === "dark" ? "dark" : "light",
      displayMode: "fullscreen",
    },
  },
);
bridge.onmessage = async ({ content }) => {
  const delayedFailure = new URLSearchParams(location.search).has("delayedFailure");
  if (delayedFailure) await new Promise(resolve => setTimeout(resolve, 5000));
  output.textContent =
    "Received through MCP Apps bridge:\n" +
    content
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("\n");
  return delayedFailure ? { isError: true } : {};
};
const timer = setTimeout(() => {
  output.textContent =
    "The app did not initialize. Check that preview.html was built and is served from this directory.";
}, 8000);
bridge.oninitialized = () => {
  clearTimeout(timer);
  void bridge.sendToolResult({ content: [], structuredContent: { title: "Recoup", version: 1 } });
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

import { App, applyDocumentTheme, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { OpenAIExtensions } from "@openai/mcp-extensions/app";

export function createHostBridge(status: HTMLElement) {
  const app = new App({ name: "Recoup", version: "1.0.0" });
  const extensions = new OpenAIExtensions(app);
  let connected = false;
  function applyContext() {
    const context = app.getHostContext();
    if (context?.theme) applyDocumentTheme(context.theme);
    if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
  }
  app.ontoolresult = () => {
    status.textContent = "Choose an experience to start with your music.";
  };
  app.onhostcontextchanged = applyContext;
  if (window.parent === window) {
    status.textContent = "Browser preview · Open the connected Recoup plugin to continue in chat.";
  } else {
    const timer = setTimeout(() => {
      if (!connected)
        status.textContent = "Still connecting. You can explore while the host connects.";
    }, 8000);
    void app
      .connect()
      .then(() => {
        connected = true;
        clearTimeout(timer);
        applyContext();
        status.textContent = "Connected to your conversation";
      })
      .catch(() => {
        clearTimeout(timer);
        status.textContent = "Could not connect. Reopen Recoup in your host.";
      });
  }

  return async (prompt: string) => {
    if (!connected)
      throw new Error("Open Recoup inside your connected plugin to continue in chat.");
    const params = { role: "user" as const, content: [{ type: "text" as const, text: prompt }] };
    return extensions.message ? extensions.message.send(params) : app.sendMessage(params);
  };
}

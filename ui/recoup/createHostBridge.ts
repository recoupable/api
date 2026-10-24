import { App, applyDocumentTheme, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { OpenAIExtensions } from "@openai/mcp-extensions/app";

export function createHostBridge(status: HTMLElement) {
  const app = new App({ name: "Recoup", version: "1.0.0" });
  const extensions = new OpenAIExtensions(app);
  let connected = false;
  let messageTarget: "new" | "active" | undefined;
  function applyContext() {
    const context = app.getHostContext();
    if (context?.theme) applyDocumentTheme(context.theme);
    if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
  }
  app.ontoolresult = result => {
    const target = result.structuredContent?.messageTarget;
    if (target === "new" || target === "active") messageTarget = target;
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
    // Both entrypoints receive {}. Distinct tools identify the destination without
    // guessing from fullscreen mode, which is shared by sidebar and thread panels.
    const tool = app.getHostContext()?.toolInfo?.tool.name;
    const target =
      messageTarget ??
      (tool === "open_recoup_workflows_sidebar"
        ? "new"
        : tool === "open_recoup_workflows"
          ? "active"
          : undefined);
    if (!target) throw new Error("Recoup is still loading. Try the card again in a moment.");
    const params = { role: "user" as const, content: [{ type: "text" as const, text: prompt }] };
    const message = extensions.message;
    if (message) {
      return message.send({ ...params, _meta: { "openai/message": { target, send: true } } });
    }
    if (target === "new") {
      throw new Error(
        "This host cannot start a new chat from Recoup. Open Recoup in a conversation panel instead.",
      );
    }
    return app.sendMessage(params);
  };
}

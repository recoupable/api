# Recoup Explore extension

A real MCP Apps UI served by the existing authenticated `/mcp` route. The `open_recoup` tool exposes OpenAI global/sidebar and thread entrypoints and a standard MCP Apps resource for other compatible hosts. Its library is public product information; it does not expose account data or change tool authorization.

## Experience

Six featured video cards open a focused brief form. Search and “See all experiences” expose 24 workflows. “Continue in chat” sends the brief, selected skill, mode and intended outputs through the MCP Apps bridge. It uses OpenAI's message extension when negotiated and standard `ui/message` otherwise. A standalone browser preview clearly identifies itself and offers a copy fallback instead of pretending to execute work.

Execution belongs to the host agent and existing Recoup skills/tools. Skill names are hints, not a skill installation mechanism. Install the Recoup skills plugin alongside the MCP connection. Tool/skill availability and missing inputs must be checked in the conversation. This version does not run generation inside the gallery, persist projects, upload files, add file handlers, or alter consent. Files are attached in the host conversation. Existing limited-scope connections remain limited; opening the library does not expand them.

## Build and review

- `pnpm build:extension`: bundle the browser SDK, UI, styles and fonts into one generated TypeScript module plus `ui/recoup/preview.html`. No runtime CDN for scripts or fonts.
- `pnpm test:extension`: protocol discovery/resource and brief validation tests.
- `node scripts/mcp-extension/build-host.mjs`: create a local SDK host harness at `ui/recoup/host.html`. Serve this directory with a loopback static server. The harness shows received messages; it does not send them to a model or remote service.
- `pnpm dev`, `pnpm build`, `pnpm test` and the OAuth typecheck build the UI first. Rebuild after editing UI source during development.

The six approved Higgsfield films are referenced by their existing HTTPS URLs; they are concept previews, not outputs generated from the current brief. They depend on that media host remaining available. The CSP allows only that media origin and no direct API connections. Do not put account files, tokens or private input data in this bundle.

## Host verification after deployment

1. Connect the deployed `/mcp` endpoint with normal Recoup OAuth, or refresh an existing connection's tool metadata.
2. Confirm `open_recoup`, `ui://recoup/explore.html`, and both global/thread entrypoints are discovered.
3. Open Recoup Explore from the sidebar and a conversation panel. Check light/dark and narrow widths, video playback/pause, reduced motion, keyboard navigation, search and the brief dialog.
4. Send a harmless brief. Verify it reaches the correct conversation and the agent resolves the intended installed skill. Check a send failure retains the brief and offers copying.
5. Exercise a real authorized workflow with the required inputs and verify its actual output. Gallery handoff alone is not end-to-end generation verification.

Local protocol and harness tests do not prove ChatGPT installation, native entrypoint display, or production workflow execution. Those checks require the deployed branch and a connected host.

References: [OpenAI extensions](https://developers.openai.com/plugins/build/extensions), [extension SDK](https://github.com/openai/mcp-extensions/tree/main/typescript), [MCP Apps](https://github.com/modelcontextprotocol/ext-apps).

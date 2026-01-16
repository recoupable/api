import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "./verifyApiKey";

/**
 * A wrapper around InMemoryTransport that injects auth info into every message.
 * This allows tools to access accountId and other auth context when using
 * in-process MCP without HTTP authentication.
 */
export class AuthenticatedInMemoryTransport implements Transport {
  private transport: InMemoryTransport;
  private authInfo: McpAuthInfo;

  constructor(transport: InMemoryTransport, authInfo: McpAuthInfo) {
    this.transport = transport;
    this.authInfo = authInfo;
  }

  get onclose() {
    return this.transport.onclose;
  }

  set onclose(handler: (() => void) | undefined) {
    this.transport.onclose = handler;
  }

  get onerror() {
    return this.transport.onerror;
  }

  set onerror(handler: ((error: Error) => void) | undefined) {
    this.transport.onerror = handler;
  }

  get onmessage() {
    return this.transport.onmessage;
  }

  set onmessage(
    handler: ((message: JSONRPCMessage, extra?: { authInfo?: unknown }) => void) | undefined,
  ) {
    this.transport.onmessage = handler;
  }

  async start(): Promise<void> {
    return this.transport.start();
  }

  async close(): Promise<void> {
    return this.transport.close();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    // Inject auth info into every message sent through this transport
    return this.transport.send(message, { authInfo: this.authInfo });
  }
}

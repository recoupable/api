import { vi } from "vitest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/agent_templates/listAgentTemplatesHandler", () => ({
  listAgentTemplatesHandler: vi.fn(),
}));

vi.mock("@/lib/agent_templates/createAgentTemplateHandler", () => ({
  createAgentTemplateHandler: vi.fn(),
}));

import { vi } from "vitest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/agent_templates/updateAgentTemplateHandler", () => ({
  updateAgentTemplateHandler: vi.fn(),
}));

vi.mock("@/lib/agent_templates/deleteAgentTemplateHandler", () => ({
  deleteAgentTemplateHandler: vi.fn(),
}));

import { describe, it, expect } from "vitest";
import {
  TOOL_CHAINS,
  TOOL_MODEL_MAP,
  ToolChainItem,
  PrepareStepResult,
} from "../toolChains";

describe("toolChains", () => {
  describe("ToolChainItem type", () => {
    it("allows basic tool chain item with just toolName", () => {
      const item: ToolChainItem = {
        toolName: "test_tool",
      };
      expect(item.toolName).toBe("test_tool");
    });

    it("allows tool chain item with system prompt", () => {
      const item: ToolChainItem = {
        toolName: "test_tool",
        system: "Custom system prompt",
      };
      expect(item.system).toBe("Custom system prompt");
    });

    it("allows tool chain item with messages", () => {
      const item: ToolChainItem = {
        toolName: "test_tool",
        messages: [{ role: "user", content: "Test message" }],
      };
      expect(item.messages).toHaveLength(1);
    });
  });

  describe("PrepareStepResult type", () => {
    it("allows result with just toolChoice", () => {
      const result: PrepareStepResult = {
        toolChoice: { type: "tool", toolName: "test_tool" },
      };
      expect(result.toolChoice?.toolName).toBe("test_tool");
    });

    it("allows result with model override", () => {
      const result: PrepareStepResult = {
        toolChoice: { type: "tool", toolName: "test_tool" },
        model: "gemini-2.5-pro" as any,
      };
      expect(result.model).toBe("gemini-2.5-pro");
    });

    it("allows result with all properties", () => {
      const result: PrepareStepResult = {
        toolChoice: { type: "tool", toolName: "test_tool" },
        model: "gemini-2.5-pro" as any,
        system: "Custom prompt",
        messages: [{ role: "user", content: "Test" }],
      };
      expect(result.toolChoice).toBeDefined();
      expect(result.model).toBeDefined();
      expect(result.system).toBeDefined();
      expect(result.messages).toBeDefined();
    });
  });

  describe("TOOL_CHAINS", () => {
    it("exports TOOL_CHAINS as an object", () => {
      expect(typeof TOOL_CHAINS).toBe("object");
    });

    it("contains create_new_artist chain", () => {
      expect(TOOL_CHAINS).toHaveProperty("create_new_artist");
      expect(Array.isArray(TOOL_CHAINS.create_new_artist)).toBe(true);
    });

    it("contains create_release_report chain", () => {
      expect(TOOL_CHAINS).toHaveProperty("create_release_report");
      expect(Array.isArray(TOOL_CHAINS.create_release_report)).toBe(true);
    });

    describe("create_new_artist chain", () => {
      it("starts with get_spotify_search", () => {
        const chain = TOOL_CHAINS.create_new_artist;
        expect(chain[0].toolName).toBe("get_spotify_search");
      });

      it("includes update_account_info with custom system prompt", () => {
        const chain = TOOL_CHAINS.create_new_artist;
        const updateAccountStep = chain.find(
          (item) => item.toolName === "update_account_info" && item.system
        );
        expect(updateAccountStep).toBeDefined();
        expect(updateAccountStep?.system).toContain("get_spotify_search");
      });

      it("has expected number of steps", () => {
        const chain = TOOL_CHAINS.create_new_artist;
        // Original chain has 17 steps after trigger
        expect(chain.length).toBeGreaterThan(10);
      });

      it("ends with youtube_login", () => {
        const chain = TOOL_CHAINS.create_new_artist;
        expect(chain[chain.length - 1].toolName).toBe("youtube_login");
      });

      it("does not include create_knowledge_base tool", () => {
        const chain = TOOL_CHAINS.create_new_artist;
        const hasCreateKnowledgeBase = chain.some(
          (item) => item.toolName === "create_knowledge_base"
        );
        expect(hasCreateKnowledgeBase).toBe(false);
      });

      it("includes generate_txt_file with system prompt for knowledge base report", () => {
        const chain = TOOL_CHAINS.create_new_artist;
        const generateStep = chain.find(
          (item) => item.toolName === "generate_txt_file"
        );
        expect(generateStep).toBeDefined();
        expect(generateStep?.system).toBeDefined();
        expect(generateStep?.system).toContain("knowledge base report");
      });

      it("includes update_account_info step with system prompt to link knowledge base", () => {
        const chain = TOOL_CHAINS.create_new_artist;
        const updateSteps = chain.filter(
          (item) => item.toolName === "update_account_info"
        );
        const knowledgeLinkStep = updateSteps.find(
          (item) => item.system?.includes("knowledges")
        );
        expect(knowledgeLinkStep).toBeDefined();
        expect(knowledgeLinkStep?.system).toContain("arweaveUrl");
      });
    });

    describe("create_release_report chain", () => {
      it("starts with web_deep_research", () => {
        const chain = TOOL_CHAINS.create_release_report;
        expect(chain[0].toolName).toBe("web_deep_research");
      });

      it("includes generate_txt_file with custom system prompt", () => {
        const chain = TOOL_CHAINS.create_release_report;
        const generateStep = chain.find(
          (item) => item.toolName === "generate_txt_file"
        );
        expect(generateStep).toBeDefined();
        expect(generateStep?.system).toBeDefined();
      });

      it("ends with send_email", () => {
        const chain = TOOL_CHAINS.create_release_report;
        expect(chain[chain.length - 1].toolName).toBe("send_email");
      });
    });
  });

  describe("TOOL_MODEL_MAP", () => {
    it("exports TOOL_MODEL_MAP as an object", () => {
      expect(typeof TOOL_MODEL_MAP).toBe("object");
    });

    it("contains update_account_info mapped to gemini model", () => {
      expect(TOOL_MODEL_MAP).toHaveProperty("update_account_info");
      expect(TOOL_MODEL_MAP.update_account_info).toBe("gemini-2.5-pro");
    });
  });
});

import { LanguageModel, ModelMessage } from "ai";
import { createReleaseReportToolChain } from "./create_release_report/createReleaseReportToolChain";
import { createNewArtistToolChain } from "./createNewArtistToolChain";

export type ToolChainItem = {
  toolName: string;
  system?: string;
  messages?: ModelMessage[];
};

export type PrepareStepResult = {
  toolChoice?: { type: "tool"; toolName: string };
  model?: LanguageModel;
  system?: string;
  messages?: ModelMessage[];
};

// Forced toolChoice is incompatible with Anthropic extended thinking.
// Tool chain steps use this model unless overridden by TOOL_MODEL_MAP.
export const TOOL_CHAIN_FALLBACK_MODEL: LanguageModel = "openai/gpt-5.4-mini";

// Map specific tools to their required models
export const TOOL_MODEL_MAP: Record<string, LanguageModel> = {
  update_account_info: "gemini-2.5-pro",
};

// Map trigger tool -> sequence AFTER trigger
export const TOOL_CHAINS: Record<string, readonly ToolChainItem[]> = {
  create_new_artist: createNewArtistToolChain,
  create_release_report: createReleaseReportToolChain,
  // You can add other chains here, e.g.:
  // create_campaign: [
  //   { toolName: "fetch_posts" },
  //   { toolName: "analyze_funnel" },
  //   { toolName: "generate_email_copy" },
  //   { toolName: "schedule_campaign" }
  // ],
};

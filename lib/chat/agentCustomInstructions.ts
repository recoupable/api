import { assistantFileLinkPrompt } from "@/lib/chat/assistantFileLinks";
import { recoupApiSkillPrompt } from "@/lib/chat/recoupApiSkillPrompt";

/**
 * Platform-wide agent instructions appended on every chat-workflow prompt.
 * Combines individual prompt fragments here so the route and tests share one
 * source of truth instead of re-joining the same strings in each place.
 */
export const agentCustomInstructions = [assistantFileLinkPrompt, recoupApiSkillPrompt].join("\n\n");

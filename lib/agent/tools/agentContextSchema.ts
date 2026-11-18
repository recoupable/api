import { z } from "zod";
import type { AgentContext } from "./AgentContext";
import { isAgentContext } from "./isAgentContext";

/** Server-only context validation; preserves model instances and sandbox state by reference. */
export const agentContextSchema = z.custom<AgentContext>(isAgentContext, "Invalid agent context");

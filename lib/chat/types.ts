import { VercelToolCollection } from "@composio/vercel";
import { type ToolSet, type StopCondition, type ToolLoopAgent } from "ai";

export interface RoutingDecision {
  model: string;
  instructions: string;
  agent: ToolLoopAgent<never, VercelToolCollection, never>;
  stopWhen?: StopCondition<NoInfer<ToolSet>> | StopCondition<NoInfer<ToolSet>>[] | undefined;
}

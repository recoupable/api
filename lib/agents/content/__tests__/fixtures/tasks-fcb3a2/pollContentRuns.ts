import type { ContentAgentCallbackBody } from "../../../validateContentAgentCallback";

// Type-only bridge: the pinned resolver runs without loading the worker's polling SDK.
export type ContentRunResult = NonNullable<ContentAgentCallbackBody["results"]>[number];

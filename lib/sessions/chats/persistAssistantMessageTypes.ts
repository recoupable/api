import type { Json } from "@/types/database.types";

/** Validated `{ message }` payload after auth + session + chat checks and JSON/Zod parsing. */
export interface ValidatedPersistSessionChatAssistantMessageRequest {
  message: {
    id: string;
    role: "assistant";
    parts: Json;
  };
}

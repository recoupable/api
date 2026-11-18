import { beforeEach, expect, it, vi } from "vitest";
import { persistProjectedAssistantStep } from "../projection/persistProjectedAssistantStep";
import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";
import { updateChat } from "@/lib/supabase/chats/updateChat";
vi.mock("@/lib/supabase/chat_messages/upsertChatMessage", () => ({ upsertChatMessage: vi.fn() }));
vi.mock("@/lib/supabase/chats/updateChat", () => ({ updateChat: vi.fn() }));
const message = {
  id: "a",
  role: "assistant",
  parts: [{ type: "text", text: "canonical" }],
} as never;
beforeEach(() => vi.resetAllMocks());
it("requires exact returned canonical message", async () => {
  vi.mocked(upsertChatMessage).mockResolvedValue({
    ok: true,
    isDuplicate: false,
    row: { id: "a", chat_id: "chat", role: "assistant", parts: message },
  } as never);
  await expect(persistProjectedAssistantStep("chat", message)).resolves.toBeUndefined();
  expect(upsertChatMessage).toHaveBeenCalledTimes(1);
});
it.each([
  null,
  { id: "a", chat_id: "other", role: "assistant", parts: message },
  { id: "a", chat_id: "chat", role: "assistant", parts: {} },
])("rejects missing or mismatched ACK without retry", async row => {
  vi.mocked(upsertChatMessage).mockResolvedValue({ ok: true, isDuplicate: !row, row } as never);
  await expect(persistProjectedAssistantStep("chat", message)).rejects.toThrow("reconciliation");
  expect(upsertChatMessage).toHaveBeenCalledTimes(1);
  expect(updateChat).not.toHaveBeenCalled();
});
it("classifies unknown transport outcome as required reconciliation", async () => {
  vi.mocked(upsertChatMessage).mockRejectedValue(new Error("transport"));
  await expect(persistProjectedAssistantStep("chat", message)).rejects.toMatchObject({
    name: "FatalError",
  });
  expect(upsertChatMessage).toHaveBeenCalledTimes(1);
});

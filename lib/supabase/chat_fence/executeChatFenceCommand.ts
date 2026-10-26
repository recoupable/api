import { preflightFencedEditMaterial } from "@/lib/chat/fence/edit/preflightFencedEditMaterial";
import { verifyFencedEditMaterial } from "@/lib/chat/fence/edit/verifyFencedEditMaterial";
import supabase from "@/lib/supabase/serverClient";
import {
  chatFenceCommandSchema,
  chatFenceIdentitySchema,
  type ChatFenceSuccess,
} from "@/lib/chat/fence/chatFenceSchemas";
import {
  classifyChatFenceError,
  type ChatFenceFailure,
} from "@/lib/chat/fence/classifyChatFenceError";
import { parseChatFenceReceipt } from "@/lib/chat/fence/parseChatFenceReceipt";
import { encodeStrictJson } from "@/lib/chat/fence/encodeStrictJson";
import { verifyChatAdmissionSnapshot } from "@/lib/chat/fence/verifyChatAdmissionSnapshot";

/** Unwired foundation for draft Database #122. Callers must authorize the effective account. */
export async function executeChatFenceCommand(
  chatId: string,
  effectiveAccount: string,
  input: unknown,
): Promise<ChatFenceSuccess | ChatFenceFailure> {
  const identity = chatFenceIdentitySchema.safeParse({ chatId, effectiveAccount });
  if (!identity.success) return classifyChatFenceError("22023");
  let command;
  try {
    if (
      input &&
      typeof input === "object" &&
      Object.getOwnPropertyDescriptor(input, "action")?.value === "delete_edit"
    ) {
      const payload = Object.getOwnPropertyDescriptor(input, "payload")?.value;
      preflightFencedEditMaterial(
        payload && typeof payload === "object"
          ? Object.getOwnPropertyDescriptor(payload, "edit_material")?.value
          : undefined,
      );
    }
    const originalBytes = encodeStrictJson(input);
    command = chatFenceCommandSchema.parse(input);
    if (command.action === "delete_edit") {
      if (encodeStrictJson(command) !== originalBytes)
        throw new Error("Edited command must already be normalized");
      const p = command.payload;
      const material = verifyFencedEditMaterial(
        {
          chatId,
          effectiveAccount,
          sessionId: p.edit_material.capture.admission.payload.execution_snapshot.sessionId,
          requestId: p.request_id,
        },
        p.edit_material,
      );
      if (
        material.capture.deletion.expectedEpoch !== p.expected_epoch ||
        material.capture.deletion.anchorId !== p.anchor_id
      )
        throw new Error("Edited deletion binding mismatch");
    }
    if (command.action === "admit") {
      const p = command.payload;
      verifyChatAdmissionSnapshot(
        {
          chatId,
          effectiveAccountId: effectiveAccount,
          sessionId: p.admission_envelope.sessionId,
          requestId: p.request_id,
          expectedEpoch: p.expected_epoch,
        },
        {
          dispatch: { status: "never_attempted", attempt_id: null },
          admission_envelope: p.admission_envelope,
          execution_snapshot: p.execution_snapshot,
          admission_canonical: p.admission_canonical,
          execution_canonical: p.execution_canonical,
          receipt: {
            chat_id: chatId,
            request_id: p.request_id,
            expected_epoch: p.expected_epoch,
            input_hash: p.input_hash,
            epoch: p.expected_epoch + 1,
            bound_run_id: null,
            closed: false,
          },
        },
      );
    }
  } catch {
    return classifyChatFenceError("22023");
  }
  try {
    // Draft RPC is intentionally absent from generated production DB types.
    // Narrow the call only here; regenerate types after an approved DB migration.
    const { data, error } = await supabase.rpc(
      "chat_fence_command" as never,
      {
        p_chat: identity.data.chatId,
        p_account: identity.data.effectiveAccount,
        p_action: command.action,
        p: command.payload,
      } as never,
    );
    if (error) return classifyChatFenceError(error.code);
    return parseChatFenceReceipt(chatId, command, data, effectiveAccount);
  } catch {
    // Transport loss can occur after commit. No automatic retries or new owner.
    return { ok: false, error: { kind: "transport_ambiguous", retrySameCommand: false } };
  }
}

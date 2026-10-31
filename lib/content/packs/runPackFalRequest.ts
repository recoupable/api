import fal from "@/lib/fal/server";
import { createHash } from "node:crypto";
/** Persist submission intent and accepted IDs before polling; ambiguous submits are never repeated. */
export async function runPackFalRequest(input: {
  model: string;
  input: Record<string, unknown>;
  chargeCredits: number;
  key: string;
  state: Record<string, unknown>;
  save: (key: string, value: unknown) => Promise<unknown>;
}) {
  type Receipt = {
    state: string;
    request_id?: string;
    data?: unknown;
    charge_credits?: number;
    model?: string;
    input_sha256?: string;
  };
  let receipt = input.state[input.key] as Receipt | undefined;
  const save = async (value: Receipt) => {
    await input.save(input.key, value);
    input.state[input.key] = value;
    receipt = value;
  };
  if (receipt?.state === "complete") return receipt.data as Record<string, unknown>;
  if (receipt && !receipt.request_id)
    throw new Error("Provider submission outcome is uncertain; automatic resubmission is blocked");
  if (receipt && (typeof receipt.model !== "string" || !receipt.model.trim()))
    throw new Error(
      "Accepted provider request has no recorded model; reconcile the original route before resuming. No request was resubmitted.",
    );
  if (!receipt) {
    await save({
      state: "submitting",
      model: input.model,
      input_sha256: createHash("sha256").update(JSON.stringify(input.input)).digest("hex"),
      charge_credits: input.chargeCredits,
    });
    const result = await fal.queue.submit(input.model, { input: input.input });
    await save({
      ...receipt!,
      state: "accepted",
      request_id: result.request_id,
    });
  }
  const requestId = receipt!.request_id!;
  const model = receipt!.model!;
  for (let poll = 0; poll < 90; poll++) {
    const status = await fal.queue.status(model, { requestId, logs: false });
    if (status.status === "COMPLETED") {
      const result = await fal.queue.result(model, { requestId });
      await save({ ...receipt!, state: "complete", request_id: requestId, data: result.data });
      return result.data as Record<string, unknown>;
    }
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
  throw new Error(
    "Accepted provider request is still processing; resume this attempt without submitting again",
  );
}

import fal from "@/lib/fal/server";
/** Persist submission intent and accepted IDs before polling; ambiguous submits are never repeated. */
export async function runPackFalRequest(input: {
  model: string;
  input: Record<string, unknown>;
  chargeCredits: number;
  key: string;
  state: Record<string, unknown>;
  save: (key: string, value: unknown) => Promise<unknown>;
}) {
  type Receipt = { state: string; request_id?: string; data?: unknown; charge_credits?: number };
  let receipt = input.state[input.key] as Receipt | undefined;
  const save = async (value: Receipt) => {
    await input.save(input.key, value);
    input.state[input.key] = value;
    receipt = value;
  };
  if (receipt?.state === "complete") return receipt.data as Record<string, unknown>;
  if (receipt && !receipt.request_id)
    throw new Error("Provider submission outcome is uncertain; automatic resubmission is blocked");
  if (!receipt) {
    await save({ state: "submitting" });
    const result = await fal.queue.submit(input.model, { input: input.input });
    await save({
      state: "accepted",
      request_id: result.request_id,
      charge_credits: input.chargeCredits,
    });
  }
  const requestId = receipt!.request_id!;
  for (let poll = 0; poll < 90; poll++) {
    const status = await fal.queue.status(input.model, { requestId, logs: false });
    if (status.status === "COMPLETED") {
      const result = await fal.queue.result(input.model, { requestId });
      await save({ state: "complete", request_id: requestId, data: result.data });
      return result.data as Record<string, unknown>;
    }
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
  throw new Error(
    "Accepted provider request is still processing; resume this attempt without submitting again",
  );
}

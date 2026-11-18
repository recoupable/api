import { FatalError, getStepMetadata } from "workflow";
/** No completion record means prior effects are unknown; never repeat them on WDK redelivery. */
export function assertFirstChatEffectAttempt(
  effect: "generation" | "message-write" | "failure-stream",
) {
  if (getStepMetadata().attempt !== 1)
    throw new FatalError(`Chat ${effect} requires reconciliation after an unknown prior attempt`);
}

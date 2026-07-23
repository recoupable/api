import redis from "@/lib/redis/connection";

/**
 * How long a zombie-owner alert stays deduped per owner. Scheduled runs can
 * fire daily; without a window every run would re-alert the same dormant
 * account. 30 days means at most one alert per owner per month.
 */
const ZOMBIE_OWNER_ALERT_DEDUP_SECONDS = 30 * 24 * 60 * 60;

const markerKey = (accountId: string) => `zombie-owner-alert:${accountId}`;

/**
 * Atomically claim the per-owner alert marker in Redis. Returns `true` when
 * this caller won the claim (first alert in the dedup window → send it) and
 * `false` when the marker already existed (a recent run already alerted → skip).
 *
 * `SET key 1 EX <ttl> NX` is atomic, so concurrent scheduled runs for the same
 * owner can't both send. Fails OPEN (returns `true`) on a Redis error so an
 * infra blip never silences a genuine alert — a duplicate alert is cheaper than
 * a missed one.
 */
export async function markZombieOwnerAlerted(accountId: string): Promise<boolean> {
  try {
    const result = await redis.set(
      markerKey(accountId),
      "1",
      "EX",
      ZOMBIE_OWNER_ALERT_DEDUP_SECONDS,
      "NX",
    );
    return result === "OK";
  } catch (error) {
    console.error("[markZombieOwnerAlerted] redis error, failing open:", error);
    return true;
  }
}

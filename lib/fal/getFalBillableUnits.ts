const FAL_KEY = process.env.FAL_KEY as string;

/**
 * Reads the exact quantity fal billed for a completed request straight off
 * the result response header — the same number fal's own billing-events API
 * reports as `output_units`, available the instant the request completes
 * (billing-events itself lags roughly 15s behind, not usable synchronously).
 *
 * `@fal-ai/client`'s `Result<T>` only carries `{ data, requestId }` and
 * discards response headers, so this bypasses the SDK for one direct read
 * of the same result endpoint it already fetched internally
 * (recoupable/app#2052).
 *
 * @param endpointId - The fal endpoint id passed to `fal.subscribe`.
 * @param requestId - `Result.requestId` from that call.
 * @returns The billable unit count, or `null` if it can't be read — callers
 *   should fall back to their own estimate rather than fail the request.
 */
export async function getFalBillableUnits(
  endpointId: string,
  requestId: string,
): Promise<number | null> {
  const [owner, alias] = endpointId.split("/");

  try {
    const response = await fetch(`https://queue.fal.run/${owner}/${alias}/requests/${requestId}`, {
      headers: { Authorization: `Key ${FAL_KEY}` },
    });
    if (!response.ok) return null;

    const raw = response.headers.get("x-fal-billable-units");
    if (!raw) return null;

    const units = Number.parseFloat(raw);
    return Number.isFinite(units) ? units : null;
  } catch {
    return null;
  }
}

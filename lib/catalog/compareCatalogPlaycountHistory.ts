const DAY_MS = 86_400_000;
// Daily scraper captures drift; beyond one hour the observation spans are not comparable.
const ALIGNMENT_TOLERANCE_MS = 3_600_000;

/**
 * Compare two complete equal UTC observation periods from one cumulative counter.
 * Keeps missing days, invalid counts and corrections explicit; never interpolates streams.
 * @param rows - One recording/provider's cumulative observations.
 * @param query - Current period start and length; previous period immediately precedes it.
 */
export function compareCatalogPlaycountHistory(
  rows: { captured_at: string; value: number }[],
  query: { since: string; days: number },
) {
  const start = Date.parse(`${query.since}T00:00:00Z`) - query.days * DAY_MS;
  const dates = Array.from({ length: query.days * 2 + 1 }, (_, i) =>
    new Date(start + i * DAY_MS).toISOString().slice(0, 10),
  );
  const byDay = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const timestamp = Date.parse(row.captured_at);
    if (!Number.isFinite(timestamp)) continue;
    const date = new Date(timestamp).toISOString().slice(0, 10);
    if (!dates.includes(date)) continue;
    const existing = byDay.get(date);
    if (!existing || timestamp > Date.parse(existing.captured_at)) byDay.set(date, row);
  }
  const observations = dates.flatMap(date => {
    const row = byDay.get(date);
    return row ? [{ date, ...row }] : [];
  });
  const missingDays = dates.filter(date => !byDay.has(date));
  const invalidDays = observations
    .filter(row => !Number.isSafeInteger(row.value) || row.value < 0)
    .map(row => row.date);
  const correctionDays = observations.flatMap((row, i) =>
    i > 0 && row.value < observations[i - 1].value ? [row.date] : [],
  );
  const aligned = observations.every(row => {
    const first = observations[0];
    const timeOfDay = Date.parse(row.captured_at) - Date.parse(`${row.date}T00:00:00Z`);
    const firstTime = Date.parse(first.captured_at) - Date.parse(`${first.date}T00:00:00Z`);
    return Math.abs(timeOfDay - firstTime) <= ALIGNMENT_TOLERANCE_MS;
  });
  const state = invalidDays.length
    ? "invalid_observation"
    : missingDays.length
      ? "incomplete"
      : correctionDays.length
        ? "counter_correction"
        : !aligned
          ? "unaligned_observations"
          : "comparable";
  const previous =
    state === "comparable" ? observations[query.days].value - observations[0].value : null;
  const current =
    state === "comparable"
      ? observations[query.days * 2].value - observations[query.days].value
      : null;
  return {
    state,
    observations,
    missing_days: missingDays,
    invalid_days: invalidDays,
    correction_days: correctionDays,
    previous_change: previous,
    current_change: current,
    absolute_growth: previous !== null && current !== null ? current - previous : null,
    percentage_growth:
      previous !== null && previous > 0 && current !== null
        ? ((current - previous) / previous) * 100
        : null,
    zero_baseline: previous === 0,
  };
}

/**
 * Expands one field of a 5-field cron expression into the set of values it
 * matches, or null when the field is malformed. Supports `*`, lists, ranges,
 * and steps (`*\/15`, `1-5/2`). Names (JAN, MON) are not supported; Trigger.dev
 * schedules are stored numerically.
 */
export function parseCronField(field: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    if (stepPart !== undefined && !/^\d+$/.test(stepPart)) return null;
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (step < 1) return null;

    let start: number;
    let end: number;
    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (/^\d+-\d+$/.test(rangePart)) {
      [start, end] = rangePart.split("-").map(Number);
    } else if (/^\d+$/.test(rangePart)) {
      start = Number(rangePart);
      end = stepPart === undefined ? start : max;
    } else {
      return null;
    }
    if (start < min || end > max || start > end) return null;
    for (let v = start; v <= end; v += step) values.add(v);
  }
  return values.size > 0 ? values : null;
}

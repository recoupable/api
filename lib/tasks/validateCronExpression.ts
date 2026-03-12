/**
 * Validates that a string is a valid 5-field cron expression.
 * Fields: minute hour day-of-month month day-of-week
 *
 * @param cron - The cron expression to validate
 * @returns true if valid, false otherwise
 */
export function isValidCronExpression(cron: string): boolean {
  const fields = cron.trim().split(/\s+/);

  if (fields.length !== 5) {
    return false;
  }

  // Each field must only contain valid cron characters: digits, *, /, -, ,
  const fieldPattern = /^(\*|[0-9]+)(\/[0-9]+)?(-[0-9]+)?(,[0-9*\-/]+)*$/;

  return fields.every(field => fieldPattern.test(field));
}

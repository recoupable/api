/** PostgreSQL text requires NUL-free Unicode scalar values, without normalization. */
export function isProposedRegistrationText(value: string): boolean {
  return !/[\u0000\uD800-\uDFFF]/u.test(value);
}

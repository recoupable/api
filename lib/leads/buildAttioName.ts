/** Attio's `name` attribute value — all three parts are required. */
export interface AttioNameValue {
  first_name: string;
  last_name: string;
  full_name: string;
}

/**
 * Builds the `name` attribute value Attio accepts. Ported from marketing#68.
 *
 * Attio rejects a partial name with `400 — invalid value for attribute "name"`,
 * so `full_name` is mandatory and `last_name` must be a string rather than
 * `undefined` (JSON.stringify drops undefined keys, which reproduces the 400).
 *
 * @param name - Free-text name as typed into a form, if any.
 * @returns The values array, or undefined when there is no name to send.
 */
export function buildAttioName(name?: string): AttioNameValue[] | undefined {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return undefined;

  const [first, ...rest] = parts;
  return [
    {
      first_name: first,
      last_name: rest.join(" "),
      full_name: parts.join(" "),
    },
  ];
}

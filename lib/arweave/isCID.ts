import { CID } from "multiformats/cid";

/**
 * Checks if a string is a CID.
 *
 * @param str - The string to check.
 * @returns True if the string is a CID, false otherwise.
 */
export function isCID(str: string | null | undefined): boolean {
  if (!str) return false;

  try {
    CID.parse(str);
    return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    console.error(e);
    return false;
  }
}

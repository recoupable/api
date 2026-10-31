/** Check for substantive characters without rewriting meaningful Unicode. */
export function hasPackTextContent(value: string): boolean {
  return /[^\s\p{Cf}\p{Default_Ignorable_Code_Point}]/u.test(value);
}

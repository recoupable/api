import type { CatalogExportDuplicate, CatalogExportProposal } from "./catalogExportTypes";

const append = (groups: Map<string, number[]>, key: string, row: number): void => {
  const rows = groups.get(key);
  if (rows) rows.push(row);
  else groups.set(key, [row]);
};

/**
 * Finds duplicate signals inside one export without dropping any proposal.
 *
 * `same_isrc` groups rows whose ISRC is present and identical; `same_row_content` groups rows whose
 * raw cells are byte-for-byte identical. A shared UPC is not reported because tracks of one
 * release legitimately share it. Groups of both kinds are returned ordered by their first row;
 * on a tie the `same_isrc` group comes first.
 *
 * @param proposals - Proposals in source row order.
 * @returns Duplicate groups, each listing at least two row ordinals.
 */
export function findCatalogExportDuplicates(
  proposals: readonly CatalogExportProposal[],
): CatalogExportDuplicate[] {
  const byIsrc = new Map<string, number[]>();
  const byContent = new Map<string, number[]>();
  for (const proposal of proposals) {
    const { isrc } = proposal.identifiers;
    if (isrc.state === "present" && isrc.value) append(byIsrc, isrc.value, proposal.pointer.row);
    append(byContent, JSON.stringify(proposal.rawCells), proposal.pointer.row);
  }
  const duplicates: CatalogExportDuplicate[] = [];
  for (const [value, rows] of byIsrc)
    if (rows.length > 1) duplicates.push({ kind: "same_isrc", value, rows });
  for (const rows of byContent.values())
    if (rows.length > 1) duplicates.push({ kind: "same_row_content", value: null, rows });
  return duplicates.sort((left, right) => left.rows[0] - right.rows[0]);
}

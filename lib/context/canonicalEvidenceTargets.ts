/** Compare UUID targets as a set without merging distinct target namespaces. */
export function canonicalEvidenceTargets(targets: ReadonlyArray<Record<string, string>>) {
  return targets
    .map(target =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(target)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => [key, value.toLowerCase()]),
        ),
      ),
    )
    .sort();
}

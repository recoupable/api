export function formatCommandOutput(label: string, output: string): string | null {
  const trimmedOutput = output.trim();
  if (!trimmedOutput) {
    return null;
  }

  return `${label}:\n${trimmedOutput}`;
}

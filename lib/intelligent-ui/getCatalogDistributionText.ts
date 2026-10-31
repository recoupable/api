/** V1 distribution text projection, parity-qualified against the pinned App formatter. */
export function getCatalogDistributionText(component: {
  title: string;
  measure: {
    label: string;
    periodStart: string;
    periodEnd: string;
    population: string;
    unit: string;
  };
  items: { label: string; value: number }[];
  complete: boolean;
  totalCount: number;
}) {
  const ranked = [...component.items].sort((a, b) => b.value - a.value);
  const total = ranked.reduce((sum, item) => sum + item.value, 0);
  const number = new Intl.NumberFormat("en");
  return `${component.title}\n${component.measure.label} · ${component.measure.periodStart} to ${component.measure.periodEnd}\n${component.measure.population}. ${component.complete ? "Complete supplied selection" : `Partial selection: ${component.items.length} of ${component.totalCount} records`}.\n${ranked.map(item => `${item.label}: ${number.format(item.value)} ${component.measure.unit}`).join("\n")}\nTotal supplied: ${number.format(total)} ${component.measure.unit}.`;
}

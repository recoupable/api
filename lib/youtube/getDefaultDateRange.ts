/**
 * Helper function to get default date range (last 30 days)
 *
 * @returns { startDate: string; endDate: string } - Default date range
 */
export function getDefaultDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // Yesterday
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 29); // 30 days ago

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}


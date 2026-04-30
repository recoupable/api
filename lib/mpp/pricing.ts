export function getPriceForRoute(path: string): number {
  if (path.includes("/ai")) return 0.002
  if (path.includes("/data")) return 0.001
  if (path.includes("/trade")) return 0.01

  return 0.0005
}
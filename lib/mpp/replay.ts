const used = new Set<string>()

export function isReplay(id: string) {
  if (used.has(id)) return true
  used.add(id)
  return false
}
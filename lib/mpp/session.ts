import crypto from "crypto"

type Session = {
  id: string
  budget: number
  spent: number
  expiresAt: number
}

const sessions = new Map<string, Session>()

export function createSession(budget = 1.0): Session {
  const session = {
    id: crypto.randomUUID(),
    budget,
    spent: 0,
    expiresAt: Date.now() + 10 * 60 * 1000
  }

  sessions.set(session.id, session)
  return session
}

export function getSession(id: string): Session | null {
  const s = sessions.get(id)
  if (!s) return null

  if (Date.now() > s.expiresAt) {
    sessions.delete(id)
    return null
  }

  return s
}

export function chargeSession(id: string, amount: number): boolean {
  const s = getSession(id)
  if (!s) return false

  if (s.spent + amount > s.budget) return false

  s.spent += amount
  return true
}
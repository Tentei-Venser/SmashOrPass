import type { Bracket, Match } from './types'

export function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function largestPowerOfTwoAtMost(n: number): number {
  let p = 1
  while (p * 2 <= n) p *= 2
  return p
}

/**
 * Builds a single-elimination bracket for N characters.
 * If N is not a power of two, round 0 is a play-in round: with P the largest
 * power of two <= N, there are N - P play-in matches and 2P - N byes.
 * Play-in winners are spread evenly through round 1 so they don't cluster.
 */
export function generateBracket(name: 'Pass' | 'Smash', ids: string[]): Bracket {
  const n = ids.length
  if (n < 2) return { name, matches: [], order: [] }

  const seeded = shuffle(ids)
  const P = largestPowerOfTwoAtMost(n)
  const playIns = n - P
  const matches: Match[] = []
  let counter = 0
  const newId = () => `${name[0].toLowerCase()}${counter++}`

  // Main rounds are numbered from 1; play-ins are round 0.
  const mainRoundCount = Math.log2(P)
  const roundMatches: Match[][] = []
  for (let r = 1; r <= mainRoundCount; r++) {
    const count = P / 2 ** r
    const list: Match[] = []
    for (let i = 0; i < count; i++) list.push({ id: newId(), round: r })
    roundMatches.push(list)
  }
  // Link main rounds forward.
  for (let r = 0; r < roundMatches.length - 1; r++) {
    roundMatches[r].forEach((m, i) => {
      const target = roundMatches[r + 1][Math.floor(i / 2)]
      m.next = { matchId: target.id, slot: i % 2 === 0 ? 'a' : 'b' }
    })
  }

  // Slots of round 1: 0..P-1 (slot s -> match floor(s/2), side a/b).
  const slotTaken = new Array<boolean>(P).fill(false)
  const playInSlots: number[] = []
  for (let i = 0; i < playIns; i++) {
    let s = Math.floor((i * P) / playIns)
    while (slotTaken[s]) s = (s + 1) % P
    slotTaken[s] = true
    playInSlots.push(s)
  }

  const playInMatches: Match[] = []
  for (let i = 0; i < playIns; i++) {
    const s = playInSlots[i]
    const target = roundMatches[0][Math.floor(s / 2)]
    playInMatches.push({
      id: newId(),
      round: 0,
      a: seeded[i * 2],
      b: seeded[i * 2 + 1],
      next: { matchId: target.id, slot: s % 2 === 0 ? 'a' : 'b' },
    })
  }

  // Byes fill the remaining round-1 slots.
  const byes = seeded.slice(playIns * 2)
  let byeIndex = 0
  for (let s = 0; s < P; s++) {
    if (slotTaken[s]) continue
    const m = roundMatches[0][Math.floor(s / 2)]
    if (s % 2 === 0) m.a = byes[byeIndex++]
    else m.b = byes[byeIndex++]
  }

  matches.push(...playInMatches, ...roundMatches.flat())
  return { name, matches, order: matches.map((m) => m.id) }
}

export function findMatch(b: Bracket, id: string): Match | undefined {
  return b.matches.find((m) => m.id === id)
}

function clearDownstream(b: Bracket, matchId: string) {
  const m = findMatch(b, matchId)
  if (!m || !m.next) return
  const target = findMatch(b, m.next.matchId)
  if (!target) return
  if (m.next.slot === 'a') target.a = undefined
  else target.b = undefined
  if (target.winner) {
    target.winner = undefined
    clearDownstream(b, target.id)
  }
}

/** Returns a new bracket with the winner set and propagated. Changing an earlier result clears dependents. */
export function pickWinner(bracket: Bracket, matchId: string, winner: string): Bracket {
  const b: Bracket = {
    ...bracket,
    matches: bracket.matches.map((m) => ({ ...m, next: m.next ? { ...m.next } : undefined })),
  }
  const m = findMatch(b, matchId)
  if (!m || (winner !== m.a && winner !== m.b)) return bracket
  if (m.winner && m.winner !== winner) clearDownstream(b, m.id)
  m.winner = winner
  if (m.next) {
    const target = findMatch(b, m.next.matchId)
    if (target) {
      if (m.next.slot === 'a') target.a = winner
      else target.b = winner
    }
  }
  return b
}

/** The next match, in play order, that has both sides filled and no winner yet. */
export function nextOpenMatch(b?: Bracket): Match | undefined {
  if (!b) return undefined
  for (const id of b.order) {
    const m = findMatch(b, id)
    if (m && m.a && m.b && !m.winner) return m
  }
  return undefined
}

export function champion(b?: Bracket): string | undefined {
  if (!b || b.matches.length === 0) return undefined
  const final = b.matches.find((m) => !m.next)
  return final?.winner
}

export type Phase = 'setup' | 'rate' | 'passBracket' | 'smashBracket' | 'done'

export interface Character {
  id: string
  name: string
  source: string
  /** Path relative to the site root (e.g. "characters/byleth.png") or a full URL / data URL. */
  image?: string
  /** Where the image was found (source page URL or site). */
  'image-credit'?: string
  /** Shown to chat/Lady__Shady only after the cold-read guess. */
  reveal?: string
  /** True when added through the New Challenger redeem. */
  challenger?: boolean
  submittedBy?: string
}

export type Verdict = 'smash' | 'pass'

/** Cold Read: picture only -> name revealed -> verdict. */
export type CardStage = 'hidden' | 'revealed'

export type RedeemKind = 'newChallenger' | 'loreDrop' | 'lawyerUp'

export interface Redeem {
  id: string
  kind: RedeemKind
  by: string
  /** Lore text, or character name for New Challenger. */
  text: string
  /** New Challenger extras. */
  source?: string
  image?: string
  status: 'pending' | 'active' | 'done' | 'rejected'
  /** Lawyer Up countdown. */
  lawyerEndsAt?: number
}

export interface Match {
  id: string
  round: number
  a?: string
  b?: string
  winner?: string
  /** Where the winner of this match goes. Undefined for the final. */
  next?: { matchId: string; slot: 'a' | 'b' }
}

export interface Bracket {
  name: 'Pass' | 'Smash'
  matches: Match[]
  /** Match ids in play order. */
  order: string[]
}

export interface GameState {
  phase: Phase
  roster: Record<string, Character>
  queue: string[]
  current?: string
  stage: CardStage
  verdicts: Record<string, Verdict>
  redeems: Redeem[]
  passBracket?: Bracket
  smashBracket?: Bracket
  champions: { pass?: string; smash?: string }
  /** Bumped on every dispatch so listeners can detect changes. */
  rev: number
}

export type Action =
  | { type: 'LOAD'; state: GameState }
  | { type: 'ADD_CHARACTER'; character: Character; playNext?: boolean }
  | { type: 'REMOVE_CHARACTER'; id: string }
  | { type: 'START_RATING'; shuffle: boolean }
  | { type: 'REVEAL' }
  | { type: 'VERDICT'; verdict: Verdict }
  | { type: 'SUBMIT_REDEEM'; redeem: Redeem }
  | { type: 'REDEEM_APPROVE'; id: string; playNext?: boolean }
  | { type: 'REDEEM_REJECT'; id: string }
  | { type: 'REDEEM_START_LAWYER'; id: string; seconds: number }
  | { type: 'REDEEM_DONE'; id: string }
  | { type: 'START_BRACKETS' }
  | { type: 'PICK'; matchId: string; winner: string }
  | { type: 'ADVANCE_PHASE' }
  | { type: 'RESET' }

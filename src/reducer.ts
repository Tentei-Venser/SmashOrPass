import type { Action, Character, GameState } from './types'
import { champion, generateBracket, pickWinner, shuffle } from './bracket'
import seed from './data/roster.json'
import imageFiles from 'virtual:character-images'

const availableImages = new Set(imageFiles)

/** True when the character's image is a URL or a file that exists in public/characters (exact case, as GitHub Pages requires). */
function hasImage(c: Character): boolean {
  if (!c.image) return false
  if (/^(https?:|data:|blob:)/i.test(c.image)) return true
  const file = c.image.match(/^\/?characters\/(.+)$/)?.[1]
  return !!file && availableImages.has(file)
}

export function initialState(): GameState {
  const roster: Record<string, Character> = {}
  const queue: string[] = []
  const skipped: string[] = []
  for (const c of seed as Character[]) {
    if (!hasImage(c)) {
      skipped.push(c.name)
      continue
    }
    roster[c.id] = c
    queue.push(c.id)
  }
  if (skipped.length > 0) console.warn(`Skipped ${skipped.length} roster character(s) with no image file: ${skipped.join(', ')}`)
  return {
    phase: 'setup',
    roster,
    queue,
    stage: 'hidden',
    verdicts: {},
    redeems: [],
    champions: {},
    rev: 0,
  }
}

function nextCard(state: GameState): GameState {
  const [current, ...rest] = state.queue
  return { ...state, current, queue: rest, stage: 'hidden' }
}

function closeActiveRedeems(state: GameState): GameState {
  return {
    ...state,
    redeems: state.redeems.map((r) => (r.status === 'active' ? { ...r, status: 'done' } : r)),
  }
}

function ratingOpen(state: GameState) {
  return state.phase === 'setup' || state.phase === 'rate'
}

function inner(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'LOAD':
      return action.state

    case 'ADD_CHARACTER': {
      if (!ratingOpen(state)) return state
      const c = action.character
      if (state.roster[c.id]) return state
      return {
        ...state,
        roster: { ...state.roster, [c.id]: c },
        queue: action.playNext ? [c.id, ...state.queue] : [...state.queue, c.id],
      }
    }

    case 'REMOVE_CHARACTER': {
      if (!ratingOpen(state) || !state.roster[action.id]) return state
      const roster = { ...state.roster }
      delete roster[action.id]
      return { ...state, roster, queue: state.queue.filter((id) => id !== action.id) }
    }

    case 'START_RATING': {
      if (state.phase !== 'setup') return state
      const queue = action.shuffle ? shuffle(state.queue) : state.queue
      return nextCard({ ...state, phase: 'rate', queue })
    }

    case 'REVEAL':
      if (state.phase !== 'rate' || !state.current) return state
      return { ...state, stage: 'revealed' }

    case 'VERDICT': {
      if (state.phase !== 'rate' || !state.current) return state
      const verdicts = { ...state.verdicts, [state.current]: action.verdict }
      return nextCard(closeActiveRedeems({ ...state, verdicts }))
    }

    case 'SUBMIT_REDEEM':
      return { ...state, redeems: [...state.redeems, action.redeem] }

    case 'REDEEM_APPROVE': {
      const redeem = state.redeems.find((r) => r.id === action.id)
      if (!redeem || redeem.status !== 'pending') return state

      if (redeem.kind === 'newChallenger') {
        if (!ratingOpen(state)) return state
        const id = `challenger-${redeem.id}`
        const character: Character = {
          id,
          name: redeem.text,
          source: redeem.source ?? 'Unknown',
          image: redeem.image,
          challenger: true,
          submittedBy: redeem.by,
        }
        return {
          ...state,
          roster: { ...state.roster, [id]: character },
          queue: action.playNext ? [id, ...state.queue] : [...state.queue, id],
          redeems: state.redeems.map((r) => (r.id === redeem.id ? { ...r, status: 'done' } : r)),
        }
      }

      const closed = closeActiveRedeems(state)
      return {
        ...closed,
        redeems: closed.redeems.map((r) => (r.id === redeem.id ? { ...r, status: 'active' } : r)),
      }
    }

    case 'REDEEM_REJECT':
      return {
        ...state,
        redeems: state.redeems.map((r) => (r.id === action.id ? { ...r, status: 'rejected' } : r)),
      }

    case 'REDEEM_START_LAWYER':
      return {
        ...state,
        redeems: state.redeems.map((r) =>
          r.id === action.id ? { ...r, lawyerEndsAt: Date.now() + action.seconds * 1000 } : r,
        ),
      }

    case 'REDEEM_DONE':
      return {
        ...state,
        redeems: state.redeems.map((r) => (r.id === action.id ? { ...r, status: 'done' } : r)),
      }

    case 'START_BRACKETS': {
      if (state.phase !== 'rate' || state.current || state.queue.length > 0) return state
      const pass = Object.keys(state.verdicts).filter((id) => state.verdicts[id] === 'pass')
      const smash = Object.keys(state.verdicts).filter((id) => state.verdicts[id] === 'smash')
      const passBracket = generateBracket('Pass', pass)
      const smashBracket = generateBracket('Smash', smash)
      return closeActiveRedeems({
        ...state,
        phase: 'passBracket',
        passBracket,
        smashBracket,
        champions: {
          // A pile of exactly one is its own champion.
          pass: pass.length === 1 ? pass[0] : undefined,
          smash: smash.length === 1 ? smash[0] : undefined,
        },
      })
    }

    case 'PICK': {
      const key = state.phase === 'passBracket' ? 'passBracket' : state.phase === 'smashBracket' ? 'smashBracket' : undefined
      if (!key) return state
      const bracket = state[key]
      if (!bracket) return state
      const updated = pickWinner(bracket, action.matchId, action.winner)
      const champ = champion(updated)
      const side = key === 'passBracket' ? 'pass' : 'smash'
      return {
        ...state,
        [key]: updated,
        champions: { ...state.champions, [side]: champ },
      }
    }

    case 'ADVANCE_PHASE': {
      if (state.phase === 'passBracket') return closeActiveRedeems({ ...state, phase: 'smashBracket' })
      if (state.phase === 'smashBracket') return closeActiveRedeems({ ...state, phase: 'done' })
      return state
    }

    case 'RESET':
      return initialState()
  }
}

export function reducer(state: GameState, action: Action): GameState {
  const next = inner(state, action)
  return next === state ? state : { ...next, rev: state.rev + 1 }
}

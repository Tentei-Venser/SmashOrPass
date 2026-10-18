import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { Action, GameState } from './types'
import { initialState, reducer } from './reducer'

const STORAGE_KEY = 'smash-or-pass:state:v1'
const CHANNEL = 'smash-or-pass'
const MAX_HISTORY = 200

function load(): GameState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as GameState) : undefined
  } catch {
    return undefined
  }
}

function save(state: GameState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be full (large pasted images) or blocked; the in-memory state still works.
  }
}

interface Wrapped {
  present: GameState
  past: GameState[]
}

type WrappedAction = Action | { type: 'UNDO' }

function wrappedReducer(w: Wrapped, action: WrappedAction): Wrapped {
  if (action.type === 'UNDO') {
    if (w.past.length === 0) return w
    const prev = w.past[w.past.length - 1]
    // Keep rev monotonic so listeners treat an undo as a change.
    return { present: { ...prev, rev: w.present.rev + 1 }, past: w.past.slice(0, -1) }
  }
  const next = reducer(w.present, action)
  if (next === w.present) return w
  if (action.type === 'LOAD') return { present: next, past: [] }
  return { present: next, past: [...w.past, w.present].slice(-MAX_HISTORY) }
}

/** Control panel: owns the state, persists it, and broadcasts every change. */
export function useControlStore() {
  const [w, dispatch] = useReducer(wrappedReducer, undefined, () => ({
    present: load() ?? initialState(),
    past: [],
  }))
  const channel = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    if ('BroadcastChannel' in window) channel.current = new BroadcastChannel(CHANNEL)
    return () => channel.current?.close()
  }, [])

  useEffect(() => {
    save(w.present)
    channel.current?.postMessage(w.present)
  }, [w.present])

  const send = useCallback((a: WrappedAction) => dispatch(a), [])
  return { state: w.present, dispatch: send, canUndo: w.past.length > 0 }
}

/**
 * Display view: read-only. Listens on BroadcastChannel and the storage event,
 * and polls storage as a last resort (some embedded browsers drop both).
 */
export function useDisplayState(): GameState {
  const [state, setState] = useState<GameState>(() => load() ?? initialState())

  useEffect(() => {
    const apply = (incoming: GameState) =>
      setState((cur) => (incoming.rev === cur.rev && incoming.phase === cur.phase ? cur : incoming))

    let channel: BroadcastChannel | undefined
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(CHANNEL)
      channel.onmessage = (e) => apply(e.data as GameState)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) apply(JSON.parse(e.newValue) as GameState)
    }
    window.addEventListener('storage', onStorage)
    const poll = window.setInterval(() => {
      const s = load()
      if (s) apply(s)
    }, 1000)

    return () => {
      channel?.close()
      window.removeEventListener('storage', onStorage)
      window.clearInterval(poll)
    }
  }, [])

  return state
}

export function exportState(state: GameState): string {
  return JSON.stringify(state, null, 2)
}

export function parseState(text: string): GameState {
  const s = JSON.parse(text) as GameState
  if (!s || typeof s !== 'object' || !s.roster || !s.phase) throw new Error('Not a Smash or Pass save file')
  return s
}

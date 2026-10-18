import { useState } from 'react'
import type { Character, GameState, Redeem, RedeemKind } from './types'
import { exportState, parseState, useControlStore } from './store'
import { findMatch, nextOpenMatch } from './bracket'
import { fileToDataUrl, uid } from './util'
import { Portrait } from './components'
import blurbData from './data/blurbs.json'

type Dispatch = ReturnType<typeof useControlStore>['dispatch']

/** Read-aloud scripts per character id: a cold-read intro plus one line for each bracket. */
const blurbs: Record<string, { intro?: string; smash?: string; pass?: string }> = blurbData

function Script({ label, text }: { label: string; text?: string }) {
  if (!text) return null
  return (
    <div className="script">
      <div className="script-label">{label}</div>
      <p>{text}</p>
    </div>
  )
}

const KIND_LABEL: Record<RedeemKind, string> = {
  newChallenger: 'New Challenger',
  loreDrop: 'Lore Drop',
  lawyerUp: 'Lawyer Up',
}

function RedeemForm({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const ratingOpen = state.phase === 'setup' || state.phase === 'rate'
  const [kind, setKind] = useState<RedeemKind>(ratingOpen ? 'newChallenger' : 'loreDrop')
  const [by, setBy] = useState('')
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageData, setImageData] = useState<string>()
  const [error, setError] = useState('')

  const effectiveKind = !ratingOpen && kind === 'newChallenger' ? 'loreDrop' : kind

  async function onFile(file?: File) {
    if (!file) return
    try {
      setImageData(await fileToDataUrl(file))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image')
    }
  }

  function submit() {
    if (!by.trim()) return setError('Who redeemed this?')
    if (effectiveKind !== 'lawyerUp' && !text.trim()) return setError(effectiveKind === 'newChallenger' ? 'Character name needed' : 'Text needed')
    const redeem: Redeem = {
      id: uid(),
      kind: effectiveKind,
      by: by.trim(),
      text: text.trim(),
      status: 'pending',
      ...(effectiveKind === 'newChallenger' ? { source: source.trim() || undefined, image: imageData ?? (imageUrl.trim() || undefined) } : {}),
    }
    dispatch({ type: 'SUBMIT_REDEEM', redeem })
    setText('')
    setSource('')
    setImageUrl('')
    setImageData(undefined)
    setError('')
  }

  return (
    <div className="panel-section">
      <h3>Log a redeem</h3>
      <div className="row">
        <select value={effectiveKind} onChange={(e) => setKind(e.target.value as RedeemKind)}>
          {(Object.keys(KIND_LABEL) as RedeemKind[])
            .filter((k) => k !== 'newChallenger' || ratingOpen)
            .map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
        </select>
        <input placeholder="Viewer name" value={by} onChange={(e) => setBy(e.target.value)} />
      </div>
      {effectiveKind !== 'lawyerUp' && (
        <input
          placeholder={effectiveKind === 'newChallenger' ? 'Character name' : 'Lore'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
      {effectiveKind === 'newChallenger' && (
        <>
          <input placeholder="Source (show, game, comic…)" value={source} onChange={(e) => setSource(e.target.value)} />
          <input placeholder="Image URL (or choose a file below)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
          {imageData && <span className="hint">Local image loaded.</span>}
        </>
      )}
      {error && <div className="error">{error}</div>}
      <button onClick={submit}>Add to queue</button>
    </div>
  )
}

function RedeemQueue({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const pending = state.redeems.filter((r) => r.status === 'pending')
  const active = state.redeems.filter((r) => r.status === 'active')
  return (
    <div className="panel-section">
      <h3>Redeem queue</h3>
      {pending.length === 0 && active.length === 0 && <div className="hint">Nothing waiting.</div>}

      {active.map((r) => (
        <div className="redeem-row active" key={r.id}>
          <div>
            <strong>{KIND_LABEL[r.kind]}</strong> · {r.by} <span className="badge">on screen</span>
            {r.text && <div className="redeem-detail">{r.text}</div>}
          </div>
          <div className="row">
            {r.kind === 'lawyerUp' && (
              <button disabled={!!r.lawyerEndsAt} onClick={() => dispatch({ type: 'REDEEM_START_LAWYER', id: r.id, seconds: 60 })}>
                Start 60s
              </button>
            )}
            <button onClick={() => dispatch({ type: 'REDEEM_DONE', id: r.id })}>Done</button>
          </div>
        </div>
      ))}

      {pending.map((r) => (
        <div className="redeem-row" key={r.id}>
          <div>
            <strong>{KIND_LABEL[r.kind]}</strong> · {r.by}
            {r.text && <div className="redeem-detail">{r.text}</div>}
            {r.kind === 'newChallenger' && <div className="redeem-detail">{r.source ?? 'No source given'}</div>}
          </div>
          <div className="row">
            <button onClick={() => dispatch({ type: 'REDEEM_APPROVE', id: r.id })}>{r.kind === 'newChallenger' ? 'Add to end' : 'Approve'}</button>
            {r.kind === 'newChallenger' && <button onClick={() => dispatch({ type: 'REDEEM_APPROVE', id: r.id, playNext: true })}>Play next</button>}
            <button className="danger" onClick={() => dispatch({ type: 'REDEEM_REJECT', id: r.id })}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function AddCharacter({ dispatch }: { dispatch: Dispatch }) {
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [image, setImage] = useState('')

  function add() {
    if (!name.trim()) return
    const character: Character = {
      id: `custom-${uid()}`,
      name: name.trim(),
      source: source.trim() || 'Unknown',
      image: image.trim() || undefined,
    }
    dispatch({ type: 'ADD_CHARACTER', character })
    setName('')
    setSource('')
    setImage('')
  }

  return (
    <div className="panel-section">
      <h3>Add a character</h3>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Source" value={source} onChange={(e) => setSource(e.target.value)} />
      <input placeholder="Image path (characters/x.jpg) or URL" value={image} onChange={(e) => setImage(e.target.value)} />
      <button onClick={add}>Add</button>
    </div>
  )
}

function SetupPanel({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const [shuffleQueue, setShuffleQueue] = useState(true)
  const characters = state.queue.map((id) => state.roster[id]).filter(Boolean)
  return (
    <>
      <div className="panel-section">
        <h3>Roster ({characters.length})</h3>
        <div className="roster-list">
          {characters.map((c) => (
            <div className="roster-item" key={c.id}>
              <span>
                {c.name} <span className="hint">· {c.source}</span>
              </span>
              <button className="danger small" onClick={() => dispatch({ type: 'REMOVE_CHARACTER', id: c.id })}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={shuffleQueue} onChange={(e) => setShuffleQueue(e.target.checked)} /> Shuffle order
        </label>
        <button className="primary" disabled={characters.length === 0} onClick={() => dispatch({ type: 'START_RATING', shuffle: shuffleQueue })}>
          Start Phase 1
        </button>
      </div>
      <AddCharacter dispatch={dispatch} />
    </>
  )
}

function RatePanel({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const c = state.current ? state.roster[state.current] : undefined
  const finished = !c && state.queue.length === 0
  return (
    <>
      <div className="panel-section">
        <h3>Phase 1 · Rate</h3>
        {c ? (
          <>
            <div className="current-card">
              <Portrait character={c} size="small" />
              <div>
                <div className="current-name">{c.name}</div>
                <div className="hint">{c.source}</div>
                <div className="hint">{state.queue.length} left after this one</div>
              </div>
            </div>
            <Script label="Read aloud · Intro" text={blurbs[c.id]?.intro} />
            <div className="row">
              <button disabled={state.stage === 'revealed'} onClick={() => dispatch({ type: 'REVEAL' })}>
                Reveal name
              </button>
              <button className="smash" onClick={() => dispatch({ type: 'VERDICT', verdict: 'smash' })}>
                Smash
              </button>
              <button className="pass" onClick={() => dispatch({ type: 'VERDICT', verdict: 'pass' })}>
                Pass
              </button>
            </div>
            <div className="hint">Cold Read: let her form an opinion from the picture, reveal, then take the verdict.</div>
          </>
        ) : finished ? (
          <>
            <div className="hint">Everyone has a verdict.</div>
            <button className="primary" onClick={() => dispatch({ type: 'START_BRACKETS' })}>
              Build the brackets
            </button>
          </>
        ) : null}
      </div>
      <AddCharacter dispatch={dispatch} />
    </>
  )
}

function BracketPanel({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const isPass = state.phase === 'passBracket'
  const bracket = isPass ? state.passBracket : state.smashBracket
  const side = isPass ? 'pass' : 'smash'
  const open = nextOpenMatch(bracket)
  const champId = state.champions[side]
  const name = (id?: string) => (id ? state.roster[id]?.name ?? '?' : '—')
  // A character's bracket blurb is read once, at the first match they appear in.
  const isDebut = (id: string) =>
    bracket?.order.map((mid) => findMatch(bracket, mid)).find((m) => m && (m.a === id || m.b === id))?.id === open?.id

  return (
    <div className="panel-section">
      <h3>{isPass ? 'Pass Bracket' : 'Smash Bracket'}</h3>
      {open ? (
        <>
          <div className="hint">{open.round === 0 ? 'Play-in' : `Round ${open.round}`}</div>
          <div className="row">
            <button className="big" onClick={() => dispatch({ type: 'PICK', matchId: open.id, winner: open.a! })}>
              {name(open.a)}
            </button>
            <button className="big" onClick={() => dispatch({ type: 'PICK', matchId: open.id, winner: open.b! })}>
              {name(open.b)}
            </button>
          </div>
          {[open.a, open.b].map(
            (id) =>
              id &&
              isDebut(id) && <Script key={id} label={`Read aloud · ${name(id)}`} text={blurbs[id]?.[side]} />,
          )}
        </>
      ) : (
        <>
          <div className="hint">{champId ? `Champion: ${name(champId)}` : 'No matches in this pile.'}</div>
          <button className="primary" onClick={() => dispatch({ type: 'ADVANCE_PHASE' })}>
            {isPass ? 'On to the Smash bracket' : 'Show final results'}
          </button>
        </>
      )}

      {bracket && bracket.matches.some((m) => m.winner) && (
        <details>
          <summary>Fix a result</summary>
          {bracket.matches
            .filter((m) => m.winner)
            .map((m) => {
              const match = findMatch(bracket, m.id)!
              return (
                <div className="roster-item" key={m.id}>
                  <span>
                    {name(match.a)} vs {name(match.b)}
                  </span>
                  <span className="row">
                    <button className={match.winner === match.a ? 'on small' : 'small'} onClick={() => dispatch({ type: 'PICK', matchId: m.id, winner: match.a! })}>
                      {name(match.a)}
                    </button>
                    <button className={match.winner === match.b ? 'on small' : 'small'} onClick={() => dispatch({ type: 'PICK', matchId: m.id, winner: match.b! })}>
                      {name(match.b)}
                    </button>
                  </span>
                </div>
              )
            })}
        </details>
      )}
    </div>
  )
}

export function Control() {
  const { state, dispatch, canUndo } = useControlStore()

  function download() {
    const blob = new Blob([exportState(state)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `smash-or-pass-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importFile(file?: File) {
    if (!file) return
    try {
      dispatch({ type: 'LOAD', state: parseState(await file.text()) })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not load that file')
    }
  }

  const displayUrl = `${window.location.pathname}?view=display`
  const phaseLabel = {
    setup: 'Setup',
    rate: 'Phase 1 · Rating',
    passBracket: 'Pass bracket',
    smashBracket: 'Smash bracket',
    done: 'Finished',
  }[state.phase]

  return (
    <div className="control">
      <header>
        <h2>Smash or Pass · Control</h2>
        <div className="row">
          <span className="badge">{phaseLabel}</span>
          <button disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })}>
            Undo
          </button>
          <a href={displayUrl} target="_blank" rel="noreferrer">
            Open display view
          </a>
        </div>
      </header>

      {state.phase === 'setup' && <SetupPanel state={state} dispatch={dispatch} />}
      {state.phase === 'rate' && <RatePanel state={state} dispatch={dispatch} />}
      {(state.phase === 'passBracket' || state.phase === 'smashBracket') && <BracketPanel state={state} dispatch={dispatch} />}
      {state.phase === 'done' && (
        <div className="panel-section">
          <h3>All done</h3>
          <div className="hint">Export the save file if you want a record of the results.</div>
        </div>
      )}

      {state.phase !== 'done' && <RedeemForm state={state} dispatch={dispatch} />}
      <RedeemQueue state={state} dispatch={dispatch} />

      <div className="panel-section">
        <h3>Save file</h3>
        <div className="row">
          <button onClick={download}>Export</button>
          <label className="file-button">
            Import
            <input type="file" accept="application/json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
          </label>
          <button
            className="danger"
            onClick={() => {
              if (confirm('Reset everything back to the starting roster?')) dispatch({ type: 'RESET' })
            }}
          >
            Reset
          </button>
        </div>
        <div className="hint">Progress autosaves in this browser after every action.</div>
      </div>
    </div>
  )
}

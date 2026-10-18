import type { Bracket, GameState, Match } from './types'
import { Portrait, useNow } from './components'
import { useDisplayState } from './store'
import { nextOpenMatch } from './bracket'

function ActiveRedeem({ state }: { state: GameState }) {
  const now = useNow()
  const redeem = [...state.redeems].reverse().find((r) => r.status === 'active')
  if (!redeem) return null

  if (redeem.kind === 'loreDrop') {
    return (
      <div className="redeem-card lore">
        <div className="redeem-title">Lore Drop</div>
        <div className="redeem-by">from {redeem.by}</div>
        <p className="redeem-text">“{redeem.text}”</p>
      </div>
    )
  }

  if (redeem.kind === 'lawyerUp') {
    const remaining = redeem.lawyerEndsAt ? Math.max(0, Math.ceil((redeem.lawyerEndsAt - now) / 1000)) : undefined
    return (
      <div className="redeem-card lawyer">
        <div className="redeem-title">Lawyer Up</div>
        <div className="redeem-by">{redeem.by} is making the case</div>
        {remaining === undefined ? (
          <div className="lore-prompt">Waiting to join voice…</div>
        ) : remaining > 0 ? (
          <div className="countdown">{remaining}s</div>
        ) : (
          <div className="lore-prompt">Lady__Shady may reconsider</div>
        )}
      </div>
    )
  }

  return null
}

function Tally({ state }: { state: GameState }) {
  const smash = Object.values(state.verdicts).filter((v) => v === 'smash').length
  const pass = Object.values(state.verdicts).filter((v) => v === 'pass').length
  const total = Object.keys(state.roster).length
  const done = smash + pass
  return (
    <div className="tally">
      <span className="tally-count">
        {done} / {total}
      </span>
      <span className="tally-smash">Smash {smash}</span>
      <span className="tally-pass">Pass {pass}</span>
    </div>
  )
}

function RateView({ state }: { state: GameState }) {
  if (state.phase === 'setup') {
    return (
      <div className="center-message">
        <h1>Smash or Pass</h1>
        <p>Starting soon…</p>
      </div>
    )
  }
  const c = state.current ? state.roster[state.current] : undefined
  const revealed = state.stage === 'revealed'
  return (
    <div className="stage">
      <Tally state={state} />
      {c ? (
        <div className="rate-layout">
          <div className="card-block">
            <Portrait character={c} hidden={!revealed} />
            <div className="name-plate">
              <div className="name">{revealed ? c.name : '???'}</div>
              <div className="source">{revealed ? c.source : 'Who do you think they are?'}</div>
              {revealed && c.challenger && <div className="challenger-tag">New Challenger · {c.submittedBy}</div>}
            </div>
          </div>
          <ActiveRedeem state={state} />
        </div>
      ) : (
        <div className="center-message">
          <h1>That’s everyone!</h1>
          <p>Time for the brackets.</p>
        </div>
      )}
    </div>
  )
}

function Side({ state, id, winner, loser }: { state: GameState; id?: string; winner: boolean; loser: boolean }) {
  const c = id ? state.roster[id] : undefined
  return (
    <div className={`versus-side ${winner ? 'winner' : ''} ${loser ? 'loser' : ''}`}>
      <Portrait character={c} />
      <div className="name-plate">
        <div className="name">{c?.name ?? 'TBD'}</div>
        <div className="source">{c?.source ?? ''}</div>
      </div>
    </div>
  )
}

function MiniBracket({ state, bracket, activeId }: { state: GameState; bracket: Bracket; activeId?: string }) {
  const rounds = new Map<number, Match[]>()
  for (const m of bracket.matches) rounds.set(m.round, [...(rounds.get(m.round) ?? []), m])
  const label = (r: number, max: number) => (r === 0 ? 'Play-ins' : r === max ? 'Final' : r === max - 1 ? 'Semis' : `Round ${r}`)
  const max = Math.max(...rounds.keys())
  const name = (id?: string) => (id ? state.roster[id]?.name ?? '?' : '—')
  return (
    <div className="mini-bracket">
      {[...rounds.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([r, ms]) => (
          <div className="mini-round" key={r}>
            <div className="mini-round-label">{label(r, max)}</div>
            {ms.map((m) => (
              <div className={`mini-match ${m.id === activeId ? 'active' : ''}`} key={m.id}>
                <div className={m.winner && m.winner === m.a ? 'won' : m.winner ? 'lost' : ''}>{name(m.a)}</div>
                <div className={m.winner && m.winner === m.b ? 'won' : m.winner ? 'lost' : ''}>{name(m.b)}</div>
              </div>
            ))}
          </div>
        ))}
    </div>
  )
}

function BracketView({ state }: { state: GameState }) {
  const bracket = state.phase === 'passBracket' ? state.passBracket : state.smashBracket
  const label = state.phase === 'passBracket' ? 'The Pass Bracket' : 'The Smash Bracket'
  const side = state.phase === 'passBracket' ? 'pass' : 'smash'
  const champId = state.champions[side]

  if (!bracket) return null
  const open = nextOpenMatch(bracket)

  if (!open) {
    const champ = champId ? state.roster[champId] : undefined
    return (
      <div className="stage">
        <div className="phase-title">{label}</div>
        <div className="center-message">
          {champ ? (
            <>
              <div className="crown">Champion</div>
              <Portrait character={champ} />
              <div className="name-plate">
                <div className="name">{champ.name}</div>
                <div className="source">{champ.source}</div>
              </div>
            </>
          ) : (
            <p>No characters in this pile.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="stage">
      <div className="phase-title">{label}</div>
      <div className="versus-layout">
        <Side state={state} id={open.a} winner={false} loser={false} />
        <div className="vs">VS</div>
        <Side state={state} id={open.b} winner={false} loser={false} />
        <ActiveRedeem state={state} />
      </div>
      <MiniBracket state={state} bracket={bracket} activeId={open.id} />
    </div>
  )
}

function DoneView({ state }: { state: GameState }) {
  const pass = state.champions.pass ? state.roster[state.champions.pass] : undefined
  const smash = state.champions.smash ? state.roster[state.champions.smash] : undefined
  return (
    <div className="stage">
      <div className="phase-title">Final Results</div>
      <div className="versus-layout">
        <div className="versus-side">
          <div className="crown">Pass Champion</div>
          <Portrait character={pass} />
          <div className="name-plate">
            <div className="name">{pass?.name ?? '—'}</div>
            <div className="source">{pass?.source}</div>
          </div>
        </div>
        <div className="vs">&amp;</div>
        <div className="versus-side">
          <div className="crown">Smash Champion</div>
          <Portrait character={smash} />
          <div className="name-plate">
            <div className="name">{smash?.name ?? '—'}</div>
            <div className="source">{smash?.source}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Display() {
  const state = useDisplayState()
  return (
    <div className="display">
      {(state.phase === 'setup' || state.phase === 'rate') && <RateView state={state} />}
      {(state.phase === 'passBracket' || state.phase === 'smashBracket') && <BracketView state={state} />}
      {state.phase === 'done' && <DoneView state={state} />}
    </div>
  )
}

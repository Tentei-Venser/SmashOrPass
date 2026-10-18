import { useEffect, useState } from 'react'
import type { Character } from './types'
import { imageSrc, initials } from './util'

export function Portrait({ character, hidden, size = 'large' }: { character?: Character; hidden?: boolean; size?: 'large' | 'small' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [character?.id])
  const src = imageSrc(character?.image)
  return (
    <div className={`portrait ${size}`}>
      {src && !failed ? (
        <>
          {/* Blurred copy fills the frame around images that don't match its shape. */}
          <img className="backdrop" src={src} alt="" aria-hidden="true" />
          <img className="fit" src={src} alt={hidden ? 'Mystery character' : character?.name} onError={() => setFailed(true)} />
        </>
      ) : (
        <div className="placeholder">{character && !hidden ? initials(character.name) : '?'}</div>
      )}
    </div>
  )
}

export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}

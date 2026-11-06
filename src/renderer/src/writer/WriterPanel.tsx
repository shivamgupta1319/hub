import { useEffect, useId, useRef, useState } from 'react'
import type { WriterState } from '@shared/ipc'
import { toneLabel, TONES, type WritingAction } from '@shared/writing'
import { CloseIcon, PenIcon, RetryIcon, SendIcon } from '../components/icons'

/** Quick changes to an answer, sent as follow-ups so they build on what's there. */
const REFINEMENTS: { label: string; instruction: string }[] = [
  { label: 'Shorter', instruction: 'make it shorter' },
  { label: 'Longer', instruction: 'make it longer' },
  ...TONES.map((tone) => ({ label: toneLabel(tone), instruction: `make it sound ${tone}` }))
]

/** Starting points when the panel opens on a selection without an action ("Custom…"). */
const QUICK_ACTIONS: { label: string; action: WritingAction }[] = [
  { label: 'Fix grammar', action: { kind: 'fix' } },
  { label: 'Improve', action: { kind: 'improve' } },
  { label: 'Shorter', action: { kind: 'shorter' } },
  { label: 'Professional', action: { kind: 'tone', tone: 'professional' } },
  { label: 'Casual', action: { kind: 'tone', tone: 'casual' } }
]

export function WriterPanel(): React.JSX.Element {
  const [state, setState] = useState<WriterState>()
  const [prompt, setPrompt] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [copied, setCopied] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const promptId = useId()
  const followUpId = useId()

  useEffect(
    () =>
      window.writer.onState((next) => {
        setState(next)
        if (next.phase === 'ask') setPrompt('')
        if (next.phase !== 'done') setCopied(false)
      }),
    []
  )

  // Main sizes the panel to its content; past the window's height the page scrolls instead.
  useEffect(() => {
    const el = panel.current
    if (!el) return
    const observer = new ResizeObserver(() => window.writer.resize(Math.ceil(el.offsetHeight)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.writer.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function submitPrompt(): void {
    const instruction = prompt.trim()
    if (!instruction || !state) return
    window.writer.run({
      action: { kind: state.mode === 'draft' ? 'draft' : 'custom', instruction }
    })
  }

  function submitFollowUp(): void {
    const instruction = followUp.trim()
    if (!instruction) return
    setFollowUp('')
    window.writer.run({ followUp: instruction })
  }

  function copy(): void {
    window.writer.copy()
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const sheet = state?.sheet ? ' is-sheet' : ''
  return (
    <div ref={panel} className={`writer${sheet}`} role="dialog" aria-label="Help me write">
      <header className="writer-head">
        <PenIcon />
        <h1 className="writer-title">{state?.label || 'Help me write'}</h1>
        <button
          type="button"
          className="writer-icon-btn"
          aria-label="Close"
          title="Close (Esc)"
          onClick={() => window.writer.close()}
        >
          <CloseIcon />
        </button>
      </header>

      {state?.phase === 'ask' && (
        <form
          className="writer-section"
          onSubmit={(e) => {
            e.preventDefault()
            submitPrompt()
          }}
        >
          <label htmlFor={promptId} className="writer-label">
            {state.mode === 'draft' ? 'What should Hub write?' : 'How should Hub change it?'}
          </label>
          <textarea
            id={promptId}
            className="field writer-prompt"
            rows={2}
            autoFocus
            value={prompt}
            placeholder={
              state.mode === 'draft'
                ? 'e.g. Reply that I can join on Friday afternoon'
                : 'e.g. Make it warmer and add a thank-you'
            }
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitPrompt()
              }
            }}
          />
          <div className="writer-actions">
            <button type="submit" className="btn btn-primary" disabled={!prompt.trim()}>
              {state.mode === 'draft' ? 'Create' : 'Rewrite'}
            </button>
          </div>
          {state.mode === 'rewrite' && (
            <ul className="writer-chips" aria-label="Or pick one">
              {QUICK_ACTIONS.map((q) => (
                <li key={q.label}>
                  <button
                    type="button"
                    className="writer-chip"
                    onClick={() => window.writer.run({ action: q.action })}
                  >
                    {q.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      )}

      {state?.phase === 'working' && (
        <div className="writer-section" aria-busy="true">
          {state.result ? (
            <p className="writer-result is-streaming">{state.result}</p>
          ) : (
            <div className="writer-skeleton" aria-label="Writing…">
              <span />
              <span />
              <span />
            </div>
          )}
          <div className="writer-actions">
            <span className="writer-status">Writing…</span>
            <span className="spacer" />
            <button type="button" className="btn" onClick={() => window.writer.stop()}>
              Stop
            </button>
          </div>
        </div>
      )}

      {state?.phase === 'done' && (
        <div className="writer-section">
          <p className="writer-result" tabIndex={0} aria-live="polite">
            {state.result}
          </p>
          <div className="writer-actions">
            {state.canApply && (
              <button
                type="button"
                className="btn btn-primary"
                autoFocus
                onClick={() => window.writer.apply()}
              >
                {state.mode === 'draft' ? 'Insert' : 'Replace'}
              </button>
            )}
            <button
              type="button"
              className="btn"
              autoFocus={!state.canApply}
              onClick={copy}
              aria-live="polite"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="writer-icon-btn"
              aria-label="Try again"
              title="Try again"
              onClick={() => window.writer.run({ retry: true })}
            >
              <RetryIcon />
            </button>
          </div>
          <ul className="writer-chips" aria-label="Adjust">
            {REFINEMENTS.map((r) => (
              <li key={r.label}>
                <button
                  type="button"
                  className="writer-chip"
                  onClick={() => window.writer.run({ followUp: r.instruction })}
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="writer-refine"
            onSubmit={(e) => {
              e.preventDefault()
              submitFollowUp()
            }}
          >
            <label htmlFor={followUpId} className="sr-only">
              Refine further
            </label>
            <input
              id={followUpId}
              className="field"
              type="text"
              autoComplete="off"
              placeholder="Refine further, e.g. mention the deadline"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
            />
            <button
              type="submit"
              className="writer-icon-btn"
              aria-label="Refine"
              disabled={!followUp.trim()}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      {state?.phase === 'error' && (
        <div className="writer-section">
          <p className="writer-error" role="alert">
            {state.error}
          </p>
          <div className="writer-actions">
            {state.needsSettings ? (
              <button
                type="button"
                className="btn btn-primary"
                autoFocus
                onClick={() => window.writer.openSettings()}
              >
                Open settings
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                autoFocus
                onClick={() => window.writer.run({ retry: true })}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      <p className="writer-note">AI can get things wrong. Check it before you send.</p>
    </div>
  )
}

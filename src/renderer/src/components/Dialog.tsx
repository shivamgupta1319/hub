import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Native modal <dialog>: focus trap, Escape and focus return come from the platform. */
export function Dialog({ title, onClose, children }: Props): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    el.showModal()
    return () => {
      el.close()
      opener?.focus()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-body">
        <h2 className="dialog-title">{title}</h2>
        {children}
      </div>
    </dialog>
  )
}

interface LoadingStateProps {
  label?: string
  overlay?: boolean
}

export function LoadingState({ label = 'Carregando...', overlay = false }: LoadingStateProps) {
  return (
    <div aria-live="polite" className={overlay ? 'loading-state loading-state-overlay' : 'loading-state'} role="status">
      <div className="loading-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <strong>{label}</strong>
        <p>Isso pode levar alguns segundos.</p>
      </div>
    </div>
  )
}

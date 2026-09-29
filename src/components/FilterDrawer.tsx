import { Filter, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'

interface FilterDrawerProps {
  children: ReactNode
  /** Painel de filtros da página: o atalho só aparece depois que ele sai da tela. */
  targetRef: RefObject<HTMLElement | null>
  title?: string
}

/** Altura ocupada no topo da tela pela barra de navegação fixa do cabeçalho compartilhado. */
function stickyHeaderOffset() {
  const nav = document.querySelector('[data-sia-header] nav')
  if (!nav) return 0
  const rect = nav.getBoundingClientRect()
  return rect.top <= 1 ? Math.max(0, Math.round(rect.bottom)) : 0
}

export function FilterDrawer({ children, targetRef, title = 'Filtros' }: FilterDrawerProps) {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  const [headerOffset, setHeaderOffset] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Lê a posição a cada rolagem em vez de observar um elemento fixo: o painel de filtros
  // pode ser recriado quando a página troca de dados.
  useEffect(() => {
    function update() {
      const bottom = targetRef.current?.getBoundingClientRect().bottom
      const passed = typeof bottom === 'number' && bottom < 0
      setVisible(passed)
      if (passed) setHeaderOffset(stickyHeaderOffset())
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [targetRef])

  useEffect(() => {
    if (!visible) setOpen(false)
  }, [visible])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-label="Abrir filtros"
        className={`filter-drawer-trigger${visible && !open ? ' filter-drawer-trigger-visible' : ''}`}
        onClick={() => setOpen(true)}
        ref={triggerRef}
        style={{ '--filter-drawer-offset': `${headerOffset}px` } as CSSProperties}
        tabIndex={visible ? 0 : -1}
        type="button"
      >
        <Filter aria-hidden="true" size={24} />
      </button>
      {open && <div aria-hidden="true" className="filter-drawer-backdrop" onClick={close} />}
      <aside aria-hidden={!open} aria-label={title} className={`filter-drawer${open ? ' filter-drawer-open' : ''}`}>
        <div className="filter-drawer-header">
          <div className="filter-drawer-brand">
            <img alt="EvidencIA Inovação" className="filter-drawer-logo" src="/assets/evidencia-logo.svg" />
            <button aria-label="Fechar filtros" className="filter-drawer-close" onClick={close} ref={closeRef} type="button">
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          <h2>{title}</h2>
        </div>
        <div className="filter-drawer-body">{children}</div>
      </aside>
    </>
  )
}

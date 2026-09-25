import { Info, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export function IbidDataInfo() {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div className="ibid-data-info" ref={root}>
      <button aria-controls={id} aria-expanded={open} aria-label="Informações sobre os dados do IBID" className="ibid-data-info-trigger" onClick={() => setOpen(!open)} ref={trigger} type="button">
        <Info aria-hidden="true" size={18} />
      </button>
      {open && (
        <div aria-labelledby={`${id}-title`} className="ibid-data-info-content" id={id} role="region">
          <div className="ibid-data-info-heading">
            <strong id={`${id}-title`}>Disponibilidade dos dados do IBID</strong>
            <button aria-label="Fechar informações do IBID" onClick={() => { setOpen(false); trigger.current?.focus() }} type="button"><X aria-hidden="true" size={18} /></button>
          </div>
          <p>A base de dados disponibilizada pelo Instituto apresenta os resultados apenas nos níveis agregados (índice geral, grupo, pilar e dimensão), por Unidade da Federação, Grande Região e média nacional.</p>
          <p>Os valores dos indicadores individuais, tanto os brutos quanto os normalizados, não são divulgados. Para cada indicador, a publicação informa apenas a descrição, a fonte original dos dados, ano de referência e como o índice é calculado</p>
        </div>
      )}
    </div>
  )
}

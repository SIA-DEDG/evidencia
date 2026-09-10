import { useMemo, useRef } from 'react'
import { CalendarClock } from 'lucide-react'
import {
  SiaHeader,
  type HeaderDataMeta,
  type HeaderNavigationItem,
} from '@sia-dedg/shared-ui'
import '@sia-dedg/shared-ui/styles.css'
import { createEvidenciaHeaderSearch } from '../data/headerSearchAdapter'

export type PageId = 'sobre' | 'ibid' | 'clp-estados' | 'clp-municipios'

interface HeaderIntegrationProps {
  page: PageId
  fontScale: number
  dataMeta?: HeaderDataMeta
  onNavigate(page: PageId): void
  onFontScaleChange(scale: number): void
  onSmartSearch(command: string): Promise<void>
}

const navigationItems: readonly HeaderNavigationItem[] = [
  { id: 'sobre', label: 'Sobre o Painel' },
  { id: 'ibid', label: 'IBID' },
  { id: 'clp-estados', label: 'CLP' },
  { id: 'comparativo', label: 'Comparativo', disabled: true },
]

export function HeaderIntegration({
  page,
  fontScale,
  dataMeta,
  onNavigate,
  onFontScaleChange,
  onSmartSearch,
}: HeaderIntegrationProps) {
  const callbacks = useRef({ onNavigate, onSmartSearch })
  callbacks.current = { onNavigate, onSmartSearch }

  const search = useMemo(() => createEvidenciaHeaderSearch({
    navigate: (nextPage) => callbacks.current.onNavigate(nextPage),
    applySmartSearch: (command) => callbacks.current.onSmartSearch(command),
  }), [])

  return (
    <>
      <SiaHeader
        activeNavigationId={page.startsWith('clp') ? 'clp-estados' : page}
        currentProject="evidencia"
        fontScale={fontScale}
        fontScales={[0.9, 1, 1.1, 1.2]}
        homeHref="/#/sobre"
        logoAlt="EvidencIA Inovação"
        logoSrc="/assets/evidencia-logo.svg"
        navigationItems={navigationItems}
        onFontScaleChange={onFontScaleChange}
        onHome={() => onNavigate('sobre')}
        onNavigation={(id) => onNavigate(id as PageId)}
        search={search}
        searchPlaceholder="Buscar no EvidencIA"
        utilityLabel="Site SIA"
      />
      {dataMeta && (
        <div className="update-strip">
          <span><CalendarClock aria-hidden="true" size={18} />Última atualização desta página: {Number.isNaN(new Date(dataMeta.updatedAt).getTime()) ? String(dataMeta.updatedAt) : new Date(dataMeta.updatedAt).toLocaleString('pt-BR')}</span>
          <span>Período dos dados: {dataMeta.dataPeriod}</span>
        </div>
      )}
    </>
  )
}

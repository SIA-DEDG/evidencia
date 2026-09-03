import { useMemo, useRef } from 'react'
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
    <SiaHeader
      activeNavigationId={page.startsWith('clp') ? 'clp-estados' : page}
      currentProject="evidencia"
      dataMeta={dataMeta}
      fontScale={fontScale}
      fontScales={[0.9, 1, 1.1, 1.2]}
      homeHref="/#/sobre"
      logoAlt="Secretaria de Inteligência Artificial, Economia Digital, Ciência, Tecnologia e Inovação — Governo do Piauí"
      logoSrc="/assets/logo.svg"
      navigationItems={navigationItems}
      onFontScaleChange={onFontScaleChange}
      onHome={() => onNavigate('sobre')}
      onNavigation={(id) => onNavigate(id as PageId)}
      search={search}
      searchPlaceholder="Buscar no EvidêncIA"
      utilityLabel="Site SIA"
    />
  )
}

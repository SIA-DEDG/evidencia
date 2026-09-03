import {
  normalizeSearchText,
  type HeaderSearchAdapter,
} from '@sia-dedg/shared-ui'
import type { PageId } from '../components/HeaderIntegration'

interface HeaderSearchResult {
  id: string
  label: string
  description: string
  action:
    | { type: 'navigate'; page: PageId }
    | { type: 'smart-search'; command: string }
}

interface HeaderSearchDependencies {
  navigate(page: PageId): void
  applySmartSearch(command: string): Promise<void>
}

const sections = [
  {
    id: 'sobre',
    label: 'Sobre o Painel',
    description: 'Apresentação dos índices e fontes',
    keywords: 'sobre painel início estudos fontes',
  },
  {
    id: 'ibid',
    label: 'IBID',
    description: 'Índice Brasil de Inovação e Desenvolvimento',
    keywords: 'ibid inovação desenvolvimento estados regiões',
  },
  {
    id: 'clp-estados',
    label: 'CLP — Estados',
    description: 'Ranking de Competitividade dos Estados',
    keywords: 'clp ranking competitividade estados regiões',
  },
  {
    id: 'clp-municipios',
    label: 'CLP — Municípios',
    description: 'Ranking de Competitividade dos Municípios',
    keywords: 'clp ranking competitividade municípios cidades',
  },
] as const

export function createEvidenciaHeaderSearch({
  navigate,
  applySmartSearch,
}: HeaderSearchDependencies): HeaderSearchAdapter<HeaderSearchResult> {
  return {
    resolve(query, signal) {
      if (signal.aborted) throw new DOMException('Busca cancelada.', 'AbortError')

      const normalizedQuery = normalizeSearchText(query)
      const tokens = normalizedQuery.split(' ').filter(Boolean)
      const matchingSections = sections.filter((section) => {
        const content = normalizeSearchText(
          `${section.label} ${section.description} ${section.keywords}`,
        )
        return tokens.every((token) => content.includes(token))
      })

      return [
        {
          id: `smart:${normalizedQuery}`,
          label: 'Aplicar filtros desta busca',
          description: 'Reconhece painel, localidade, região, ano e métrica',
          action: { type: 'smart-search', command: query },
        },
        ...matchingSections.map((section) => ({
          id: `section:${section.id}`,
          label: section.label,
          description: section.description,
          action: { type: 'navigate' as const, page: section.id },
        })),
      ]
    },
    getId: (result) => result.id,
    getLabel: (result) => result.label,
    getDescription: (result) => result.description,
    async apply(result) {
      if (result.action.type === 'navigate') {
        navigate(result.action.page)
        return
      }
      await applySmartSearch(result.action.command)
    },
  }
}

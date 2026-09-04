import pg from 'pg'
import type {
  DashboardDataset,
  DashboardKind,
  DetailRow,
  FilterDefinition,
  RankingHistoryItem,
  RankingItem,
  SelectOption,
  SummaryMetric,
} from '../src/types/dashboard'

type QueryValues = Record<string, string | undefined>

interface TerritoryRow {
  id: string
  codigo: string
  sigla: string | null
  nome: string
  tipo: 'BRASIL' | 'REGIAO' | 'UF' | 'MUNICIPIO'
  parent_id: string | null
}

interface ResultRow extends TerritoryRow {
  ano_referencia: number
  nota: number | null
  posicao: number | null
}

interface DetailResultRow {
  componente_id?: string
  id: string
  nota: number | null
  posicao: number | null
}

interface ComponentRow {
  id: string
  codigo: string
  tipo: string
  nome: string
  parent_id: string | null
  ordem_exibicao: number | null
  descricao: string | null
  fonte: string | null
  unidade_medida: string | null
}

const kindConfig = {
  ibid: {
    research: 'IBID',
    entityType: 'UF',
    source: 'INPI – Coordenação-Geral de Economia e Inovação',
    metricTypes: ['GERAL', 'GRUPO', 'PILAR', 'DIMENSAO'],
  },
  'clp-estados': {
    research: 'ESTADOS',
    entityType: 'UF',
    source: 'Centro de Liderança Pública (CLP)',
    metricTypes: ['GERAL', 'PILAR'],
  },
  'clp-municipios': {
    research: 'MUNICIPIOS',
    entityType: 'MUNICIPIO',
    source: 'Centro de Liderança Pública (CLP)',
    metricTypes: ['GERAL', 'DIMENSAO', 'PILAR'],
  },
} as const

const typeLabels: Record<string, string> = {
  GERAL: 'Nota Geral',
  GRUPO: 'Grupo',
  PILAR: 'Pilar',
  DIMENSAO: 'Dimensão',
  INDICADOR: 'Indicador',
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scoreDecimals(kind: DashboardKind) {
  return kind === 'ibid' ? 3 : 2
}

function scoreText(kind: DashboardKind, value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: scoreDecimals(kind),
    maximumFractionDigits: scoreDecimals(kind),
  })
}

function rankText(position: number | null | undefined, total: number) {
  return position ? `${position}º/${total}` : '—'
}

function titleForMetric(component: Pick<ComponentRow, 'tipo' | 'nome'>, kind: DashboardKind) {
  if (component.tipo === 'GERAL') return kind === 'ibid' ? 'Nota Geral - IBID' : 'Nota Geral - CLP'
  return `${typeLabels[component.tipo] ?? component.tipo} - ${component.nome}`
}

function toOption(territory: TerritoryRow): SelectOption {
  return { label: territory.sigla ? `${territory.nome} (${territory.sigla})` : territory.nome, value: territory.codigo }
}

function findTerritory(rows: TerritoryRow[], code: string | undefined, fallback: (row: TerritoryRow) => boolean) {
  return rows.find((row) => row.codigo === code) ?? rows.find(fallback) ?? rows[0]
}

function valueRank(rows: Array<Pick<ResultRow, 'id' | 'nota'>>, territoryId: string) {
  const valid = rows.filter((row) => row.nota !== null).sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0))
  const index = valid.findIndex((row) => row.id === territoryId)
  return index < 0 ? undefined : index + 1
}

function average(rows: Array<Pick<ResultRow, 'nota'>>) {
  const values = rows.flatMap((row) => row.nota === null ? [] : [row.nota])
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function ranking(rows: ResultRow[]): RankingItem[] {
  return rows
    .filter((row) => row.nota !== null)
    .sort((a, b) => (a.posicao ?? Number.MAX_SAFE_INTEGER) - (b.posicao ?? Number.MAX_SAFE_INTEGER) || (b.nota ?? 0) - (a.nota ?? 0))
    .slice(0, 5)
    .map((row, index) => ({ position: row.posicao ?? index + 1, name: row.sigla ?? row.nome, value: row.nota! }))
}

function scopedRanking(rows: ResultRow[]): RankingItem[] {
  return rows
    .filter((row) => row.nota !== null)
    .sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0))
    .slice(0, 5)
    .map((row, index) => ({ position: index + 1, name: row.sigla ?? row.nome, value: row.nota! }))
}

function historyFor(territory: TerritoryRow | undefined, results: ResultRow[], entities: TerritoryRow[]): RankingHistoryItem[] {
  if (!territory) return []
  const years = [...new Set(results.map((row) => row.ano_referencia))].sort((a, b) => a - b)
  return years.flatMap((year) => {
    const yearResults = results.filter((row) => row.ano_referencia === year && row.tipo === territory.tipo)
    const current = yearResults.find((row) => row.id === territory.id)
    if (!current?.posicao) return []
    const peerIds = new Set(entities.filter((row) => row.parent_id === territory.parent_id).map((row) => row.id))
    const peers = yearResults.filter((row) => peerIds.has(row.id))
    return [{
      year,
      national: current.posicao,
      nationalTotal: yearResults.filter((row) => row.nota !== null).length,
      regional: valueRank(peers, territory.id),
      regionalTotal: peers.filter((row) => row.nota !== null).length,
    }]
  })
}

function makeSummary(
  kind: DashboardKind,
  metricLabel: string,
  selectedYear: number,
  primary: TerritoryRow,
  comparison: TerritoryRow | undefined,
  entityResults: ResultRow[],
  peers: ResultRow[],
  scopeName: string,
  scopeScore?: number | null,
): SummaryMetric[] {
  const primaryResult = entityResults.find((row) => row.id === primary.id && row.ano_referencia === selectedYear)
  const comparisonResult = comparison
    ? entityResults.find((row) => row.id === comparison.id && row.ano_referencia === selectedYear)
    : undefined
  const total = entityResults.filter((row) => row.ano_referencia === selectedYear && row.nota !== null).length
  const primaryEyebrow = kind === 'clp-municipios' ? 'Município principal' : 'Estado principal'
  const comparisonEyebrow = kind === 'clp-municipios' ? 'Comparação com o município' : 'Comparação com'
  const scopeEyebrow = kind === 'clp-municipios' ? 'Média do estado' : 'Média da região'

  return [
    {
      eyebrow: primaryEyebrow,
      title: primary.nome,
      metric: metricLabel,
      rank: rankText(primaryResult?.posicao, total),
      note: `nota ${scoreText(kind, primaryResult?.nota)}`,
      emphasis: 'primary',
    },
    {
      eyebrow: comparisonEyebrow,
      title: comparison?.nome ?? 'Não selecionado',
      metric: metricLabel,
      rank: comparison ? rankText(comparisonResult?.posicao, total) : '—',
      note: comparison ? `nota ${scoreText(kind, comparisonResult?.nota)}` : 'selecione para comparar',
    },
    {
      eyebrow: scopeEyebrow,
      title: scopeName,
      metric: metricLabel,
      rank: '—',
      note: `nota ${scoreText(kind, scopeScore ?? average(peers))}`,
    },
  ]
}

function buildDetails(
  components: ComponentRow[],
  detailResults: DetailResultRow[],
  primary: TerritoryRow,
  scopeTerritoryId: string | undefined,
  kind: DashboardKind,
  selectedYear: number,
  entities: TerritoryRow[],
) {
  const byParent = new Map<string, ComponentRow[]>()
  for (const component of components) {
    if (!component.parent_id) continue
    const siblings = byParent.get(component.parent_id) ?? []
    siblings.push(component)
    byParent.set(component.parent_id, siblings)
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => (a.ordem_exibicao ?? 9999) - (b.ordem_exibicao ?? 9999) || a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  const resultByComponent = new Map<string, DetailResultRow[]>()
  for (const result of detailResults) {
    if (!result.componente_id) continue
    const values = resultByComponent.get(result.componente_id) ?? []
    values.push(result)
    resultByComponent.set(result.componente_id, values)
  }
  const peerIds = new Set(entities.filter((row) => row.parent_id === scopeTerritoryId).map((row) => row.id))

  function descend(component: ComponentRow, path: number[]): DetailRow {
    const results = resultByComponent.get(component.id) ?? []
    const primaryResult = results.find((row) => row.id === primary.id)
    const peerResults = results.filter((row) => peerIds.has(row.id))
    const officialRegion = kind === 'ibid' ? results.find((row) => row.id === scopeTerritoryId) : undefined
    const regionalRank = valueRank(peerResults, primary.id)
    const children = byParent.get(component.id) ?? []
    const level = (typeLabels[component.tipo] ?? 'Indicador') as DetailRow['level']
    return {
      id: component.id,
      level,
      title: `${path.join('.')}. ${component.nome}`,
      nationalRank: primaryResult?.posicao ? `${primaryResult.posicao}º` : '—',
      nationalScore: scoreText(kind, primaryResult?.nota),
      regionalRank: regionalRank ? `${regionalRank}º` : '—',
      regionalScore: scoreText(kind, officialRegion?.nota ?? average(peerResults)),
      year: String(selectedYear),
      description: component.descricao ?? undefined,
      source: component.fonte ?? undefined,
      children: children.map((child, index) => descend(child, [...path, index + 1])),
    }
  }

  const general = components.find((component) => component.tipo === 'GERAL')
  const roots = general ? byParent.get(general.id) ?? [] : components.filter((component) => !component.parent_id)
  return roots.map((root, index) => descend(root, [index + 1]))
}

export class DashboardService {
  constructor(private readonly pool: pg.Pool) {}

  async getDashboard(kind: DashboardKind, values: QueryValues): Promise<DashboardDataset> {
    const config = kindConfig[kind]
    const client = await this.pool.connect()
    try {
      const editionResult = await client.query<{
        id: string
        ano: number
        updated_at: string
      }>(`
        select e.id, e.ano, max(ci.concluida_em)::text as updated_at
        from edicao e
        join pesquisa p on p.id = e.pesquisa_id
        join carga_importacao ci on ci.status = 'SUCESSO'
        join arquivo_fonte af on af.id = ci.arquivo_fonte_id and af.edicao_id = e.id and af.ativo
        where p.codigo = $1
        group by e.id
        order by e.ano desc limit 1
      `, [config.research])
      const edition = editionResult.rows[0]
      if (!edition) throw new Error(`Não há carga concluída para ${config.research}.`)

      const territoryResult = await client.query<TerritoryRow>(`
        select t.id, t.codigo, t.sigla, t.nome, t.tipo, t.parent_id
        from territorio t
        where t.tipo in ('REGIAO', 'UF', 'MUNICIPIO')
        order by t.nome
      `)
      const allTerritories = territoryResult.rows
      const regions = allTerritories.filter((row) => row.tipo === 'REGIAO')
      const states = allTerritories.filter((row) => row.tipo === 'UF')
      const municipalities = allTerritories.filter((row) => row.tipo === 'MUNICIPIO')
      const municipalityParentIds = new Set(municipalities.map((row) => row.parent_id))
      const availableStates = kind === 'clp-municipios' ? states.filter((row) => municipalityParentIds.has(row.id)) : states
      const selectedState = findTerritory(availableStates, values.state, (row) => row.sigla === 'PI')
      const availableEntities = kind === 'clp-municipios'
        ? municipalities.filter((row) => row.parent_id === selectedState?.id)
        : states
      const primary = findTerritory(
        availableEntities,
        values.primary,
        (row) => kind === 'clp-municipios' ? row.nome === 'Teresina' : row.sigla === 'PI',
      )
      if (!primary) throw new Error('Nenhum território disponível para o painel.')
      const comparison = availableEntities.find((row) => row.codigo === values.comparison && row.id !== primary.id)

      const metricResult = await client.query<ComponentRow>(`
        select distinct on (c.id) c.id, c.codigo, c.tipo, ce.nome,
          null::uuid as parent_id, ce.ordem::integer as ordem_exibicao,
          ce.descricao, ce.fonte, ce.unidade_medida
        from componente c
        join pesquisa p on p.id = c.pesquisa_id
        join componente_edicao ce on ce.componente_id = c.id and ce.edicao_id = $2
        join carga_importacao ci on ci.id = ce.carga_importacao_id and ci.status = 'SUCESSO'
        where p.codigo = $1 and c.tipo = any($3::varchar[])
        order by c.id, ci.concluida_em desc
      `, [config.research, edition.id, config.metricTypes])
      const metrics = metricResult.rows.sort((a, b) => {
        const order = config.metricTypes.indexOf(a.tipo as never) - config.metricTypes.indexOf(b.tipo as never)
        return order || (a.ordem_exibicao ?? 9999) - (b.ordem_exibicao ?? 9999) || a.nome.localeCompare(b.nome, 'pt-BR')
      })
      const metric = metrics.find((row) => row.codigo === values.metric) ?? metrics.find((row) => row.tipo === 'GERAL') ?? metrics[0]
      if (!metric) throw new Error('Nenhum indicador disponível para o painel.')

      const allResultsQuery = await client.query<ResultRow>(`
        select t.id, t.codigo, t.sigla, t.nome, t.tipo, t.parent_id,
          rr.ano_referencia, rr.nota_normalizada::float8 as nota, rr.posicao
        from resultado_ranking rr
        join territorio t on t.id = rr.territorio_id
        where rr.edicao_id = $1 and rr.componente_id = $2
          and t.tipo = any($3::varchar[])
      `, [edition.id, metric.id, kind === 'ibid' ? [config.entityType, 'REGIAO'] : [config.entityType]])
      const allResults = allResultsQuery.rows.map((row) => ({ ...row, nota: numberValue(row.nota) }))
      const entityResults = allResults.filter((row) => row.tipo === config.entityType)
      const years = [...new Set(entityResults.map((row) => row.ano_referencia))].sort((a, b) => a - b)
      const selectedYear = years.includes(Number(values.year)) ? Number(values.year) : years.at(-1)
      if (!selectedYear) throw new Error(`Não há resultados para ${metric.nome}.`)

      const selectedRegion = regions.find((row) => row.id === primary.parent_id)
        ?? regions.find((row) => row.codigo === values.region)
      const scopeTerritory = kind === 'clp-municipios' ? selectedState : selectedRegion
      const comparisonScopeTerritory = comparison
        ? kind === 'clp-municipios'
          ? selectedState
          : regions.find((row) => row.id === comparison.parent_id)
        : undefined
      const hasDistinctComparisonScope = Boolean(
        comparisonScopeTerritory && comparisonScopeTerritory.id !== scopeTerritory?.id,
      )
      const scopeName = scopeTerritory?.nome ?? 'Brasil'
      const peerIds = new Set(allTerritories.filter((row) => row.tipo === config.entityType && row.parent_id === scopeTerritory?.id).map((row) => row.id))
      const selectedPeers = entityResults.filter((row) => row.ano_referencia === selectedYear && peerIds.has(row.id))
      const selectedEntities = entityResults.filter((row) => row.ano_referencia === selectedYear)
      const selectedOfficialRegion = kind === 'ibid'
        ? allResults.find((row) => row.tipo === 'REGIAO' && row.codigo === selectedRegion?.codigo && row.ano_referencia === selectedYear)
        : undefined
      const metricLabel = titleForMetric(metric, kind)

      const seriesByTerritory = (territory: TerritoryRow | undefined) => years.map((year) => {
        if (!territory) return null
        return entityResults.find((row) => row.id === territory.id && row.ano_referencia === year)?.nota ?? null
      })
      const nationalAverageSeries = years.map((year) => (
        average(entityResults.filter((row) => row.ano_referencia === year))
      ))
      const seriesByScope = (scope: TerritoryRow | undefined) => {
        const scopedPeerIds = new Set(
          allTerritories
            .filter((row) => row.tipo === config.entityType && row.parent_id === scope?.id)
            .map((row) => row.id),
        )

        return years.map((year) => {
          const officialRegion = kind === 'ibid'
            ? allResults.find((row) => row.tipo === 'REGIAO' && row.codigo === scope?.codigo && row.ano_referencia === year)
            : undefined
          if (officialRegion?.nota !== null && officialRegion?.nota !== undefined) return officialRegion.nota
          return average(entityResults.filter((row) => row.ano_referencia === year && scopedPeerIds.has(row.id)))
        })
      }
      const regionalSeries = seriesByScope(scopeTerritory)
      const comparisonRegionalSeries = hasDistinctComparisonScope ? seriesByScope(comparisonScopeTerritory) : []
      const allChartValues = [
        ...seriesByTerritory(primary),
        ...seriesByTerritory(comparison),
        ...nationalAverageSeries,
        ...regionalSeries,
        ...comparisonRegionalSeries,
      ]
        .filter((value): value is number => value !== null)
      const rawMax = Math.max(...allChartValues, kind === 'ibid' ? 1 : 100)
      const yMax = kind === 'ibid' ? Math.min(1, Math.ceil(rawMax * 10) / 10) : Math.ceil(rawMax / 10) * 10

      const structureResult = await client.query<{ id: string }>(`
        select e.id
        from estrutura e
        join carga_importacao ci on ci.id = e.carga_importacao_id and ci.status = 'SUCESSO'
        where e.edicao_id = $1 and ($2 <> 'IBID' or e.codigo = 'IBID')
          and ($2 = 'IBID' or e.codigo = 'PADRAO')
        order by (select count(*) from estrutura_componente ec where ec.estrutura_id = e.id) desc,
          ci.concluida_em desc
        limit 1
      `, [edition.id, config.research])
      const structureId = structureResult.rows[0]?.id
      let components: ComponentRow[] = []
      let details: DetailRow[] = []
      if (structureId) {
        const componentResult = await client.query<ComponentRow>(`
          select c.id, c.codigo, c.tipo, ce.nome, ec.parent_componente_id as parent_id,
            ec.ordem_exibicao, ce.descricao, ce.fonte, ce.unidade_medida
          from estrutura_componente ec
          join componente c on c.id = ec.componente_id
          join estrutura e on e.id = ec.estrutura_id
          left join componente_edicao ce on ce.componente_id = c.id
            and ce.edicao_id = e.edicao_id and ce.carga_importacao_id = e.carga_importacao_id
          where ec.estrutura_id = $1
          order by ec.ordem_exibicao nulls last, c.codigo
        `, [structureId])
        components = componentResult.rows
        const componentIds = components.map((component) => component.id)
        const detailTerritoryIds = new Set(peerIds)
        detailTerritoryIds.add(primary.id)
        if (kind === 'ibid' && scopeTerritory?.id) detailTerritoryIds.add(scopeTerritory.id)
        const detailResult = await client.query<DetailResultRow>(`
          select rr.componente_id, rr.territorio_id as id,
            rr.nota_normalizada::float8 as nota, rr.posicao
          from resultado_ranking rr
          where rr.edicao_id = $1 and rr.componente_id = any($2::uuid[])
            and rr.ano_referencia = $3
            and rr.territorio_id = any($4::uuid[])
        `, [edition.id, componentIds, selectedYear, [...detailTerritoryIds]])
        const detailRows = detailResult.rows.map((row) => ({ ...row, nota: numberValue(row.nota) }))
        details = buildDetails(components, detailRows, primary, scopeTerritory?.id, kind, selectedYear, allTerritories)
      }

      const stateOptions = availableStates.map((state) => kind === 'clp-municipios'
        ? {
            label: `${state.nome} · ${municipalities.filter((municipality) => municipality.parent_id === state.id).length} municípios`,
            value: state.codigo,
          }
        : toOption(state))
      const primaryOptions = availableEntities.map(toOption)
      const regionOptions = regions.map((region) => ({
        label: `${region.nome} · ${states.filter((state) => state.parent_id === region.id).length} estados`,
        value: region.codigo,
      }))
      const filters: FilterDefinition[] = kind === 'clp-municipios'
        ? [
            { id: 'state', label: 'Estado', value: selectedState.codigo, options: stateOptions },
            { id: 'primary', label: 'Município principal', value: primary.codigo, options: primaryOptions },
            { id: 'comparison', label: 'Comparação com o município', value: comparison?.codigo ?? '', options: [{ label: 'Selecione um município', value: '' }, ...primaryOptions.filter((option) => option.value !== primary.codigo)] },
            { id: 'year', label: 'Ano', value: String(selectedYear), options: years.slice().reverse().map((year) => ({ label: String(year), value: String(year) })) },
            { id: 'metric', label: 'Métrica', value: metric.codigo, options: metrics.map((item) => ({ label: titleForMetric(item, kind), value: item.codigo })) },
          ]
        : [
            { id: 'primary', label: 'Estado principal', value: primary.codigo, options: stateOptions },
            { id: 'comparison', label: 'Comparação com', value: comparison?.codigo ?? '', options: [{ label: 'Selecione um estado', value: '' }, ...stateOptions.filter((option) => option.value !== primary.codigo)] },
            { id: 'region', label: 'Região', value: selectedRegion?.codigo ?? '', options: regionOptions, disabled: true },
            { id: 'year', label: 'Ano', value: String(selectedYear), options: years.slice().reverse().map((year) => ({ label: String(year), value: String(year) })) },
            { id: 'metric', label: 'Métrica', value: metric.codigo, options: metrics.map((item) => ({ label: titleForMetric(item, kind), value: item.codigo })) },
          ]

      return {
        kind,
        meta: {
          updatedAt: new Date(edition.updated_at).toISOString(),
          dataPeriod: years.length === 1 ? String(years[0]) : `${years[0]}–${years.at(-1)}`,
          source: config.source,
        },
        filters,
        summary: makeSummary(kind, metricLabel, selectedYear, primary, comparison, entityResults, selectedPeers, scopeName, selectedOfficialRegion?.nota),
        chart: {
          years,
          primary: seriesByTerritory(primary),
          comparison: seriesByTerritory(comparison),
          nationalAverage: nationalAverageSeries,
          regional: regionalSeries,
          comparisonRegional: comparisonRegionalSeries,
          primaryLabel: primary.nome,
          comparisonLabel: comparison?.nome ?? 'Comparação',
          regionalLabel: kind === 'clp-municipios' ? `Média de ${scopeName}` : `Média do ${scopeName}`,
          comparisonRegionalLabel: comparisonScopeTerritory
            ? `Média do ${comparisonScopeTerritory.nome}`
            : '',
          yMax,
        },
        rankingLabels: {
          national: kind === 'clp-municipios' ? 'Top 5 Brasil' : 'Top 5 Brasil',
          regional: kind === 'clp-municipios' ? `Top 5 ${scopeName}` : `Top 5 ${scopeName}`,
        },
        nationalRanking: ranking(selectedEntities),
        regionalRanking: scopedRanking(selectedPeers),
        history: historyFor(primary, entityResults, allTerritories),
        comparisonHistory: historyFor(comparison, entityResults, allTerritories),
        details,
      }
    } finally {
      client.release()
    }
  }
}

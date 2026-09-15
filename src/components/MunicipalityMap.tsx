import { useEffect, useState } from 'react'
import type { RankingItem } from '../types/dashboard'
import { ChoroplethMap, type MapLocation } from './ChoroplethMap'

interface StateMesh {
  viewBox: string
  locations: MapLocation[]
}

// Malhas geradas por scripts/build-municipal-maps.mjs; cada estado é baixado uma única vez.
const meshCache = new Map<string, Promise<StateMesh>>()

function loadStateMesh(uf: string) {
  let request = meshCache.get(uf)
  if (!request) {
    request = fetch(`/maps/municipios/${uf}.json`).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json() as Promise<StateMesh>
    })
    request.catch(() => meshCache.delete(uf))
    meshCache.set(uf, request)
  }
  return request
}

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

interface MunicipalityMapProps {
  comparisonCode?: string
  decimals: number
  metricLabel: string
  onSelect?: (code: string) => void
  ranking: RankingItem[]
  selectedCode?: string
  stateName: string
  uf: string
  year: string
}

export function MunicipalityMap({ comparisonCode, decimals, metricLabel, onSelect, ranking, selectedCode, stateName, uf, year }: MunicipalityMapProps) {
  const [mesh, setMesh] = useState<{ uf: string; value: StateMesh } | null>(null)
  const [failedUf, setFailedUf] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setFailedUf(null)
    loadStateMesh(uf)
      .then((value) => { if (active) setMesh({ uf, value }) })
      .catch(() => { if (active) setFailedUf(uf) })
    return () => { active = false }
  }, [uf])

  // O banco não guarda o código IBGE dos municípios, então a ligação com a malha é feita pelo nome.
  const itemByName = new Map(ranking.map((item) => [normalizeName(item.name), item]))
  const rankedInState = ranking.filter((item) => !item.wasNull).sort((a, b) => b.value - a.value)
  const statePosition = new Map(rankedInState.map((item, index) => [item.code, index + 1]))
  const current = mesh?.uf === uf ? mesh.value : undefined

  return (
    <ChoroplethMap
      ariaLabel={`Mapa dos municípios de ${stateName} por ${metricLabel}`}
      comparisonCode={comparisonCode}
      decimals={decimals}
      description={<>{metricLabel} - CLP · {stateName}. Clique em um município avaliado para selecioná-lo.</>}
      emptyMessage={failedUf === uf ? 'Não foi possível carregar o mapa dos municípios.' : current ? undefined : 'Carregando mapa dos municípios…'}
      itemFor={(location) => itemByName.get(normalizeName(location.name))}
      kind="clp-municipios"
      locations={current?.locations ?? []}
      noDataLabel="Não avaliado"
      onSelect={onSelect}
      positionText={(item) => [
        ...(item.position ? [`${item.position}º no Brasil`] : []),
        `${statePosition.get(item.code)}º em ${uf}`,
      ]}
      selectedCode={selectedCode}
      title={`Mapa dos municípios por nota${year ? ` (${year})` : ''}`}
      titleId="municipality-map-title"
      viewBox={current?.viewBox ?? '0 0 1000 1000'}
    />
  )
}

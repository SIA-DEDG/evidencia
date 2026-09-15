// Gera public/maps/municipios/{UF}.json com os contornos dos municípios de cada estado.
// Fonte: IBGE (malhas territoriais e localidades). Uso: node scripts/build-municipal-maps.mjs [UF...]
import { mkdir, writeFile } from 'node:fs/promises'

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']
const WIDTH = 1000
const outputDir = new URL('../public/maps/municipios/', import.meta.url)

async function getJson(url) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url)
    if (response.ok) return response.json()
    if (attempt >= 3) throw new Error(`${response.status} ao baixar ${url}`)
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
  }
}

function polygonsOf(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates
  return []
}

async function buildState(uf) {
  const [mesh, names] = await Promise.all([
    getJson(`https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio`),
    getJson(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`),
  ])
  const nameById = new Map(names.map((item) => [String(item.id), item.nome]))

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const feature of mesh.features) {
    for (const polygon of polygonsOf(feature.geometry)) {
      for (const ring of polygon) {
        for (const [lon, lat] of ring) {
          minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon)
          minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
        }
      }
    }
  }

  // Projeção equiretangular corrigida pela latitude média: suficiente na escala de um estado.
  const lonFactor = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180)
  const scale = WIDTH / ((maxLon - minLon) * lonFactor)
  const height = Math.ceil((maxLat - minLat) * scale)
  const round = (value) => Math.round(value * 10) / 10

  const locations = mesh.features.map((feature) => {
    const id = String(feature.properties.codarea)
    const path = polygonsOf(feature.geometry).flatMap((polygon) => polygon.map((ring) => {
      let previous = ''
      const points = []
      for (const [lon, lat] of ring) {
        const point = `${round((lon - minLon) * lonFactor * scale)},${round((maxLat - lat) * scale)}`
        if (point !== previous) points.push(point)
        previous = point
      }
      return `M${points.join('L')}Z`
    })).join('')
    return { id, name: nameById.get(id) ?? id, path }
  })

  await writeFile(new URL(`${uf}.json`, outputDir), JSON.stringify({ viewBox: `0 0 ${WIDTH} ${height}`, locations }))
  console.log(`${uf}: ${locations.length} municípios`)
}

await mkdir(outputDir, { recursive: true })
const requested = process.argv.slice(2).map((uf) => uf.toUpperCase())
for (const uf of requested.length ? requested : UFS) await buildState(uf)

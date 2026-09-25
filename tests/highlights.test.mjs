import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHighlights } from '../server/highlights.ts'

const pillar = { id: 'pillar', tipo: 'PILAR', nome: 'Infraestrutura', parent_id: null }
const result = (year, position, extra = {}) => ({ componente_id: pillar.id, ano_referencia: year, posicao: position, ...extra })
const items = (rows, kind = 'clp-estados') => buildHighlights([pillar], rows, 2025, kind).flatMap(group => group.items)

test('calcula a variação pelas posições de 2024 e 2025, ignorando o delta importado', () => {
  const [item] = items([result(2023, 27), result(2025, 13, { delta_posicao: -118 }), result(2024, 18)])
  assert.equal(item.change, 5)
  assert.equal(item.direction, 'up')
  assert.equal(item.previousPosition, 18)
  assert.equal(item.previousYear, 2024)
  assert.equal(item.currentPosition, 13)
  assert.equal(item.year, 2025)
})

test('não usa o último ano disponível se faltar o ano imediatamente anterior', () => {
  assert.deepEqual(items([result(2023, 20), result(2025, 2, { delta_posicao: 18 })]), [])
})

test('não cria destaque só com a posição atual, mesmo no top 3', () => {
  assert.deepEqual(items([result(2025, 1, { delta_posicao: 4 })]), [])
})

test('não reaproveita destaque antigo quando falta posição no ano selecionado', () => {
  assert.deepEqual(items([result(2023, 10), result(2024, 2)]), [])
  assert.deepEqual(items([result(2024, 2), result(2025, null)]), [])
})

test('ignora posições inválidas e a falta de ranking anterior', () => {
  for (const previous of [null, 0, -1, NaN]) {
    assert.deepEqual(items([result(2024, previous), result(2025, 2)]), [])
  }
})

test('fora do top 10, só mostra variações de mais de três posições', () => {
  assert.deepEqual(items([result(2024, 20), result(2025, 17)]), [])
  assert.deepEqual(items([result(2024, 17), result(2025, 20)]), [])
  assert.deepEqual(items([result(2024, 20), result(2025, 20)]), [])
  assert.equal(items([result(2024, 20), result(2025, 16)])[0].change, 4)
  const [fall] = items([result(2024, 16), result(2025, 20)])
  assert.equal(fall.change, -4)
  assert.equal(fall.direction, 'down')
})

test('reconhece entrada nos top 10, top 5 e top 3 em relação ao ano anterior', () => {
  for (const [previous, current, tier] of [[11, 10, 10], [6, 5, 5], [4, 3, 3]]) {
    const [item] = items([result(2024, previous), result(2025, current)])
    assert.equal(item.topTier, tier)
    assert.equal(item.topStatus, 'entered')
  }
})

test('mantém o destaque de permanência no top, incluindo posição estável', () => {
  const [item] = items([result(2024, 8), result(2025, 8)])
  assert.equal(item.change, 0)
  assert.equal(item.direction, 'stable')
  assert.equal(item.topStatus, 'remained')
  assert.equal(item.topTier, 10)
})

test('a regra anual é a mesma para IBID, CLP estados e CLP municípios', () => {
  for (const kind of ['ibid', 'clp-estados', 'clp-municipios']) {
    assert.equal(items([result(2024, 18), result(2025, 14)], kind).length, 1)
    assert.deepEqual(items([result(2023, 18), result(2025, 14)], kind), [])
  }
})

test('omite grupos sem destaque e mantém o vínculo dos indicadores com o pilar', () => {
  const indicator = { id: 'indicator', tipo: 'INDICADOR', nome: 'Rodovias', parent_id: pillar.id }
  const groups = buildHighlights([pillar, indicator], [
    result(2024, 19), result(2025, 18),
    result(2024, 12, { componente_id: indicator.id }), result(2025, 8, { componente_id: indicator.id }),
  ], 2025, 'clp-estados')
  assert.deepEqual(groups.map(group => group.id), ['indicador'])
  assert.equal(groups[0].items[0].pillarId, pillar.id)
})

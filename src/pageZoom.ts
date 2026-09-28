/** Largura em que o layout foi desenhado: acima dela, a página é ampliada para ocupar a tela toda. */
const DESIGN_WIDTH = 1440

let currentZoom = 1

/** Fator de zoom aplicado ao documento; converte medidas da viewport em pixels CSS da página. */
export function pageZoom() {
  return currentZoom
}

function applyPageZoom() {
  // innerWidth não é afetado pelo zoom CSS do documento, evitando um ciclo de recálculo.
  const width = window.innerWidth
  const zoom = Math.max(1, width / DESIGN_WIDTH)
  if (Math.abs(zoom - currentZoom) < 0.001) return
  currentZoom = zoom
  const root = document.documentElement
  root.style.setProperty('--page-zoom', String(zoom))
  root.style.zoom = zoom === 1 ? '' : String(zoom)
}

/** Mantém a página proporcional à largura da janela, inclusive com o zoom do navegador reduzido. */
export function installPageZoom() {
  applyPageZoom()
  window.addEventListener('resize', applyPageZoom)
}

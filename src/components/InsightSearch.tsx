import { Search } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { editDistance, normalizeSearchText, tokenSimilarity } from '../data/dashboardSearch'

const MAX_SUGGESTIONS = 8
/** Similaridade mínima para sugerir um nome que não contém o texto digitado. */
const MIN_SIMILARITY = 0.7

interface Suggestion {
  name: string
  exact: boolean
  score: number
}

/** Similaridade de uma palavra digitada com uma palavra do nome, aceitando que ela ainda esteja incompleta. */
function wordSimilarity(queryWord: string, nameWord: string) {
  const prefix = queryWord.length >= 3 && nameWord.length > queryWord.length
    ? 1 - editDistance(nameWord.slice(0, queryWord.length), queryWord) / queryWord.length
    : 0
  return Math.max(tokenSimilarity(nameWord, queryWord), prefix)
}

/** Nomes que contêm o texto vêm primeiro; depois os parecidos, para quem digitou com erro. */
export function rankSuggestions(query: string, names: string[]): Suggestion[] {
  const term = normalizeSearchText(query)
  if (!term) return []
  const queryWords = term.split(' ').filter((word) => word.length >= 3)

  return names
    .flatMap((name): Suggestion[] => {
      const normalized = normalizeSearchText(name)
      const index = normalized.indexOf(term)
      if (index >= 0) return [{ name, exact: true, score: 2 - index / (normalized.length + 1) }]
      const nameWords = normalized.split(' ')
      const wordScore = queryWords.length
        ? queryWords.reduce((sum, queryWord) => sum + Math.max(...nameWords.map((nameWord) => wordSimilarity(queryWord, nameWord))), 0) / queryWords.length
        : 0
      const wholeScore = 1 - editDistance(normalized, term) / Math.max(normalized.length, term.length)
      const score = Math.max(wordScore, wholeScore)
      return score >= MIN_SIMILARITY ? [{ name, exact: false, score }] : []
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, MAX_SUGGESTIONS)
}

interface InsightSearchProps {
  level: string
  names: string[]
  onChange: (value: string) => void
  value: string
}

export function InsightSearch({ level, names, onChange, value }: InsightSearchProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const suggestions = rankSuggestions(value, names)
  // Não sugere de novo o nome que já foi escolhido.
  const visible = suggestions.length === 1 && normalizeSearchText(suggestions[0].name) === normalizeSearchText(value) ? [] : suggestions
  const expanded = open && visible.length > 0

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  function select(name: string) {
    onChange(name)
    setOpen(false)
    setActive(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!expanded) {
      if (event.key === 'ArrowDown' && visible.length) setOpen(true)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % visible.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index <= 0 ? visible.length : index) - 1)
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      select(visible[active].name)
    }
  }

  return (
    <div className="insight-search-root" ref={rootRef}>
      <label className="insight-search">
        <Search aria-hidden="true" size={16} />
        <input
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={expanded}
          aria-label={`Buscar ${level} no perfil e em forças e fraquezas`}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={`Buscar ${level}…`}
          role="combobox"
          type="search"
          value={value}
        />
      </label>
      {expanded && (
        <ul className="insight-search-results" id={listId} role="listbox">
          {visible.map((suggestion, index) => (
            <li
              aria-selected={index === active}
              className={index === active ? 'insight-search-result insight-search-result-active' : 'insight-search-result'}
              id={`${listId}-${index}`}
              key={suggestion.name}
              // mousedown evita que o campo perca o foco antes da seleção.
              onMouseDown={(event) => {
                event.preventDefault()
                select(suggestion.name)
              }}
              onMouseEnter={() => setActive(index)}
              role="option"
            >
              <span>{suggestion.name}</span>
              {!suggestion.exact && <small>Parecido</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

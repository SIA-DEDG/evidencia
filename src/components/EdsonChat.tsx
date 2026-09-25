import { Send, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

export interface EdsonMessage {
  role: 'assistant' | 'user'
  content: string
}

interface EdsonChatProps {
  open: boolean
  onClose(): void
  /** Conectar ao serviço do Edson quando a integração estiver disponível. */
  onSendMessage?: (messages: EdsonMessage[]) => Promise<string>
}

export function EdsonChat({ open, onClose, onSendMessage }: EdsonChatProps) {
  const id = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<EdsonMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open, onClose])

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [messages, open, sending])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim() || sending || !onSendMessage) return
    const conversation: EdsonMessage[] = [...messages, { role: 'user', content: draft.trim() }]
    setSending(true)
    setError('')
    setMessages(conversation)
    setDraft('')
    try {
      const reply = await onSendMessage(conversation)
      if (!reply.trim()) throw new Error('Resposta vazia')
      setMessages([...conversation, { role: 'assistant', content: reply }])
    } catch {
      setMessages(messages)
      setDraft(conversation.at(-1)!.content)
      setError('Não foi possível enviar a mensagem. Tente novamente.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <aside aria-labelledby={`${id}-title`} aria-modal="false" className="edson-chat" hidden={!open} id="edson-chat" role="dialog">
      <header className="edson-chat-header">
        <img alt="" aria-hidden="true" height={44} src="/assets/edson-empty-state.svg" width={44} />
        <div><h2 id={`${id}-title`}>Edson</h2><p>Assistente do painel</p></div>
        <button aria-label="Fechar chat do Edson" onClick={onClose} ref={closeRef} type="button"><X aria-hidden="true" size={22} /></button>
      </header>
      <div aria-label="Conversa com o Edson" aria-relevant="additions text" className="edson-chat-messages" ref={logRef} role="log">
        <div className="edson-chat-message edson-chat-message-assistant">
          <strong>Edson</strong>
          <p>Olá! Este é o espaço para conversar sobre os índices, metodologias e comparações do IBID e CLP.</p>
        </div>
        {!onSendMessage && <p className="edson-chat-unavailable" id={`${id}-status`} role="status">O atendimento do Edson ainda não está disponível. Em breve você poderá enviar suas perguntas por aqui.</p>}
        {messages.map((message, index) => (
          <div className={`edson-chat-message edson-chat-message-${message.role}`} key={index}>
            <strong>{message.role === 'user' ? 'Você' : 'Edson'}</strong><p>{message.content}</p>
          </div>
        ))}
        {sending && <p className="edson-chat-status" role="status">Edson está respondendo…</p>}
      </div>
      {error && <p className="edson-chat-error" role="alert">{error}</p>}
      <form className="edson-chat-form" onSubmit={send}>
        <label className="sr-only" htmlFor={`${id}-message`}>Mensagem para o Edson</label>
        <textarea
          aria-describedby={!onSendMessage ? `${id}-status` : undefined}
          disabled={!onSendMessage || sending}
          id={`${id}-message`}
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={onSendMessage ? 'Digite sua pergunta…' : 'Envio de mensagens indisponível'}
          ref={inputRef}
          rows={2}
          value={draft}
        />
        <button aria-label="Enviar mensagem" disabled={!onSendMessage || sending || !draft.trim()} type="submit"><Send aria-hidden="true" size={20} /></button>
      </form>
    </aside>
  )
}

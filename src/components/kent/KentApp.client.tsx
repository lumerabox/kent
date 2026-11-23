'use client'

import { Globe, Languages, ListChecks, Paintbrush, PanelLeft, Pencil, Pin, PinOff, Search, SquarePen, Trash2, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'

import { Icon } from '@/components/icons'
import { nextSuggestion } from '@/lib/ai/choices'
import { chatTime, groupChats, type ChatSummary } from '@/lib/ai/history'

import { chats } from './chats'
import { Composer, usePanelDrop, type ComposerHandle } from './Composer.client'
import { KentGrab, KentStudio } from './KentGrab.client'
import { KentMark } from './KentMark'
import { Thread } from './Thread.client'
import { useAiChat } from './useAiChat.client'
import { useAiMode } from './useAiMode.client'
import { useKentState } from './useKentState.client'

type Suggestion = { icon: LucideIcon; label: string; fill?: string; send?: string }

const SUGGESTIONS: Suggestion[] = [
  { icon: Globe, label: 'Search the web', fill: '/research ' },
  { icon: ListChecks, label: 'Summarize', fill: '/summarize ' },
  { icon: Pencil, label: 'Rewrite', fill: '/rewrite ' },
  { icon: Languages, label: 'Translate', fill: '/translate ' },
]

function greeting(now = new Date()) {
  const h = now.getHours()
  return h < 11 ? 'Good morning' : h < 15 ? 'Good afternoon' : h < 19 ? 'Good evening' : 'Working late?'
}

function Hello({ ready, onPick }: { ready: boolean; onPick: (s: Suggestion) => void }) {
  return (
    <div className="kt-hello">
      <span className="kt-hello__mark kt-kent-in" style={{ '--i': 0 } as CSSProperties}>
        <KentGrab align="center">
          <KentMark size={56} follow lively react="page" />
        </KentGrab>
      </span>
      <h2 className="kt-hello__title kt-kent-in" suppressHydrationWarning style={{ '--i': 1 } as CSSProperties}>
        {greeting()}
      </h2>
      <p className="kt-hello__sub kt-kent-in" style={{ '--i': 2 } as CSSProperties}>
        {ready ? 'What can I help you with?' : 'Set AI_API_KEY on the server to start chatting.'}
      </p>
      <div className="kt-hello__chips kt-kent-in" style={{ '--i': 3 } as CSSProperties}>
        {SUGGESTIONS.map((s) => (
          <button key={s.label} type="button" className="kt-ai-chip" disabled={!ready} onClick={() => onPick(s)}>
            <Icon icon={s.icon} size={13} />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const EMPTY: ChatSummary[] = []

function History({ activeId, onOpen, onDeleted }: { activeId: string | null; onOpen: (id: string) => void; onDeleted: (id: string) => void }) {
  const list = useSyncExternalStore(chats.subscribe, chats.list, () => EMPTY)
  const [q, setQ] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return list
    return list.filter((c) => c.title.toLowerCase().includes(k) || chats.get(String(c.id))?.messages.some((m) => m.content.toLowerCase().includes(k)))
  }, [list, q])
  const pinned = shown.filter((c) => c.pinned)
  const groups = [...(pinned.length ? [{ label: 'Pinned', items: pinned }] : []), ...groupChats(shown.filter((c) => !c.pinned), 'drawer')]
  return (
    <div className="kt-hist">
      <label className="kt-hist__search">
        <Icon icon={Search} size={14} />
        <input value={q} placeholder="Search chats" aria-label="Search chats" onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="kt-hist__scroll">
        {!shown.length ? <p className="kt-hist__empty">{q ? 'No chats found' : 'No chats yet'}</p> : null}
        {groups.map((g) => (
          <div key={g.label} className="kt-hist__group">
            <p className="kt-hist__label">{g.label}</p>
            {g.items.map((c) => {
              const id = String(c.id)
              return (
                <div key={id} className={`kt-hist__item${id === activeId ? ' kt-hist__item--on' : ''}`}>
                  {renaming === id ? (
                    <input
                      className="kt-hist__rename"
                      defaultValue={c.title}
                      autoFocus
                      aria-label="Chat title"
                      onBlur={(e) => {
                        chats.rename(id, e.target.value)
                        setRenaming(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setRenaming(null)
                      }}
                    />
                  ) : (
                    <button type="button" className="kt-hist__open" title={c.title} onClick={() => onOpen(id)} onDoubleClick={() => setRenaming(id)}>
                      <span className="kt-hist__title">{c.title}</span>
                      <span className="kt-hist__time">{chatTime(c.updatedAt)}</span>
                    </button>
                  )}
                  <span className="kt-hist__tools">
                    <button type="button" aria-label={c.pinned ? 'Unpin' : 'Pin'} title={c.pinned ? 'Unpin' : 'Pin'} onClick={() => chats.pin(id, !c.pinned)}>
                      <Icon icon={c.pinned ? PinOff : Pin} size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete"
                      title="Delete"
                      onClick={() => {
                        if (!window.confirm(`Delete "${c.title}"?`)) return
                        chats.remove([id])
                        onDeleted(id)
                      }}
                    >
                      <Icon icon={Trash2} size={13} />
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

const SIDE_KEY = 'kent-side'

export function KentApp({ ready }: { ready: boolean }) {
  const chat = useAiChat()
  const [mode, setMode] = useAiMode()
  const [side, setSide] = useState(true)
  const [studio, setStudio] = useState(false)
  const composer = useRef<ComposerHandle>(null)
  const panelDrop = usePanelDrop(composer, ready)
  const end = useRef<HTMLDivElement>(null)
  const streaming = chat.status === 'streaming'
  const kent = useKentState(streaming, chat.turns.at(-1)?.status, chat.error)
  const empty = !chat.turns.length && !chat.error

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDE_KEY) === '0' || window.innerWidth < 760) setSide(false)
    } catch {}
    const id = new URLSearchParams(window.location.search).get('chat')
    if (id) chat.load(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toggleSide = () =>
    setSide((s) => {
      try {
        localStorage.setItem(SIDE_KEY, s ? '0' : '1')
      } catch {}
      return !s
    })

  useEffect(() => {
    const url = chat.chatId ? `/?chat=${chat.chatId}` : '/'
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, '', url)
  }, [chat.chatId])

  const last = chat.turns.at(-1)?.content.length ?? 0
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [chat.turns.length, last, chat.error])

  const send = (text: string) => chat.send(text, { mode })
  const pick = (s: Suggestion) => (s.send ? send(s.send) : composer.current?.fill(s.fill ?? ''))
  const newChat = () => {
    chat.reset()
    composer.current?.focus()
  }

  return (
    <div className={`kt-page kt-app${side ? '' : ' kt-app--noside'}`}>
      <aside className="kt-side" aria-hidden={!side} inert={!side}>
        <div className="kt-side__head">
          <span className="kt-side__brand">
            <KentMark size={22} state={kent} />
            <span>Kent</span>
          </span>
          <button type="button" className="kt-icon-btn" aria-label="New chat" title="New chat" onClick={newChat}>
            <Icon icon={SquarePen} size={16} />
          </button>
        </div>
        <History activeId={chat.chatId} onOpen={(id) => chat.load(id)} onDeleted={(id) => id === chat.chatId && chat.reset()} />
        <div className="kt-side__foot">
          <button type="button" className="kt-side__link" onClick={() => setStudio(true)}>
            <Icon icon={Paintbrush} size={15} />
            Change appearance
          </button>
        </div>
      </aside>
      <section className="kt-main" {...panelDrop.dropProps}>
        {panelDrop.overlay}
        <header className="kt-top">
          <button type="button" className="kt-icon-btn" aria-label={side ? 'Hide chats' : 'Show chats'} title={side ? 'Hide chats' : 'Show chats'} onClick={toggleSide}>
            <Icon icon={PanelLeft} size={16} />
          </button>
          <p className="kt-top__title">{chat.title || (empty ? '' : 'New chat')}</p>
          {!side ? (
            <button type="button" className="kt-icon-btn" aria-label="New chat" title="New chat" onClick={newChat}>
              <Icon icon={SquarePen} size={16} />
            </button>
          ) : null}
        </header>
        <div className={`kt-messages${empty ? ' kt-messages--empty' : ''}`}>
          <div className="kt-col">
            {empty ? (
              <Hello ready={ready} onPick={pick} />
            ) : (
              <Thread turns={chat.turns} streaming={streaming} error={chat.error} onRetry={chat.retry} onSend={send} />
            )}
            <div ref={end} />
          </div>
        </div>
        <div className="kt-composer">
          <div className="kt-col">
            <Composer
              ref={composer}
              suggestion={nextSuggestion(chat.turns.at(-1)?.role === 'assistant' ? chat.turns.at(-1)?.content : undefined)}
              placeholder={!ready ? 'Kent is not set up' : chat.turns.length ? 'Reply…' : 'Ask anything…'}
              chips={[]}
              streaming={streaming}
              disabled={!ready}
              mode={mode}
              onMode={setMode}
              attach
              queued={chat.queued}
              onUnqueue={chat.unqueue}
              onSend={send}
              onStop={chat.stop}
              onEditLast={chat.beginEdit}
              onEditCancel={chat.cancelEdit}
            />
          </div>
        </div>
      </section>
      {studio ? <KentStudio onClose={() => setStudio(false)} /> : null}
    </div>
  )
}

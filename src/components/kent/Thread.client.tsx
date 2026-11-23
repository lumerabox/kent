'use client'

import { CircleAlert, Copy, FileText, ImageIcon, RotateCcw } from 'lucide-react'
import { memo, useEffect, useState } from 'react'

import { Icon } from '@/components/icons'
import { toast } from '@/components/toast'
import { splitChoices, type Choice } from '@/lib/ai/choices'
import { statusPhase, statusSteps, type AiDocRef } from '@/lib/ai/events'
import { kentStateOf } from '@/lib/ai/kent-phase'

import { splitAttachments } from './attach'
import { KentLoader } from './KentMark'
import { Markdown } from './Markdown.client'
import type { Turn } from './useAiChat.client'

// Conversation: user messages (right bubble), answers, source cards, busy card.

/** Cited web sources: domain, title, date; open in a new tab */
function SourceCards({ docs }: { docs: AiDocRef[] }) {
  const date = (d?: string) =>
    d ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`)) : ''
  return (
    <div className="kt-ai-sources" aria-label="Sources">
      {docs.map((d) => (
        <a key={d.href} className="kt-ai-source" href={d.href} target="_blank" rel="noreferrer noopener" title={d.href}>
          <span className="kt-ai-source__domain">{d.source?.domain}</span>
          <span className="kt-ai-source__title">{d.title}</span>
          {d.source?.date ? <span className="kt-ai-source__date">{date(d.source.date)}</span> : null}
        </a>
      ))}
    </div>
  )
}

/** Cards under an answer: cited sources (deduplicated) */
function DocCards({ docs }: { docs: AiDocRef[] }) {
  const sources = [...new Map(docs.filter((d) => d.source).map((d) => [d.href, d])).values()]
  return sources.length ? <SourceCards docs={sources} /> : null
}

/** Stream masih jalan tapi teks berhenti >2,5 dtk tanpa status dari server: tetap tampilkan bahwa Kent bekerja */
function IdleStatus({ content }: { content: string }) {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setIdle(true), 2500)
    return () => {
      clearTimeout(t)
      setIdle(false)
    }
  }, [content])
  return idle ? <StatusLine status="working" /> : null
}

/** Baris progres: teks berganti tiap 2,6 dtk selama status sama, plus lama berjalan setelah 5 dtk (key = status, jadi ganti status = mulai ulang) */
function StatusLine({ status }: { status: string }) {
  const steps = statusSteps(status)
  const [step, setStep] = useState(0)
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const t = window.setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000)
      setSecs(s)
      setStep(Math.min(steps.length - 1, Math.floor(s / 2.6)))
    }, 500)
    return () => clearInterval(t)
  }, [status, steps.length])
  const text = steps[Math.min(step, steps.length - 1)]
  return (
    <p className="kt-ai-status" role="status" aria-live="polite">
      <KentLoader state={kentStateOf(true, status)} />
      <span className="kt-ai-status__phase">{statusPhase(status)}</span>
      <span key={`${status}-${step}`} className="kt-ai-status__text">
        <span className="kt-ai-shine">{`${text}…`}</span>
      </span>
      {secs >= 5 ? <span className="kt-ai-status__time">{`${secs}s`}</span> : null}
    </p>
  )
}

export function BusyCard({ error, onRetry }: { error: string; onRetry: () => void }) {
  const busy = /busy|connection/i.test(error) || !error
  return (
    <div className="kt-ai-busy" role="alert">
      <p className="kt-ai-busy__title">
        <Icon icon={CircleAlert} size={16} />
        {busy ? 'AI is busy right now' : 'Could not send'}
      </p>
      <p className="kt-ai-busy__body">{busy ? 'Your message is kept. Try again in a minute.' : error}</p>
      <button type="button" className="kt-btn kt-btn--primary kt-ai-btn" onClick={onRetry}>
        <Icon icon={RotateCcw} size={14} />
        Try again
      </button>
    </div>
  )
}

/** Di-memo: pesan panjang (teks panjang ditempel) tidak diproses ulang tiap potongan stream */
const UserBubble = memo(function UserBubble({ content, fresh }: { content: string; fresh?: boolean }) {
  const { text, files, images } = splitAttachments(content)
  return (
    <div className={`kt-ai-user${fresh ? ' kt-ai-in' : ''}`}>
      {images.some((f) => f.url) ? (
        <div className="kt-ai-shots">
          {images
            .filter((f) => f.url)
            .map((f, j) => (
              <a key={`shot-${j}`} className="kt-ai-shot" href={f.url} target="_blank" rel="noreferrer" title={f.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- attached image */}
                <img src={f.url} alt={f.name} loading="lazy" decoding="async" />
              </a>
            ))}
        </div>
      ) : null}
      {files.length || images.some((f) => !f.url) ? (
        <div className="kt-ai-files kt-ai-files--sent">
          {images
            .filter((f) => !f.url)
            .map((f, j) => (
              <span key={`img-${j}`} className="kt-ai-file" title={f.name}>
                <Icon icon={ImageIcon} size={14} />
                <span className="kt-ai-file__name">{f.name}</span>
              </span>
            ))}
          {files.map((f, j) => (
            <span key={j} className="kt-ai-file" title={f}>
              <Icon icon={FileText} size={14} />
              <span className="kt-ai-file__name">{f}</span>
            </span>
          ))}
        </div>
      ) : null}
      {text ? <p>{text}</p> : null}
    </div>
  )
})

/** Lama Kent menjawab (dari pesan user sebelumnya); hanya ditampilkan bila lebih dari 30 detik */
function tookLabel(turns: Turn[], i: number) {
  const a = turns[i]?.at
  const u = turns[i - 1]?.role === 'user' ? turns[i - 1].at : undefined
  if (!a || !u) return null
  const s = Math.round((Date.parse(a) - Date.parse(u)) / 1000)
  if (!(s > 30) || s > 6 * 3600) return null
  const m = Math.floor(s / 60)
  return `Answered in ${m ? `${m}m ` : ''}${s % 60}s`
}

/** Pilihan atas pertanyaan Kent: klik = kirim jawabannya; rekomendasi di depan dan diberi label */
function ChoiceButtons({ options, onSend }: { options: Choice[]; onSend?: (text: string) => void }) {
  if (!options.length) return null
  return (
    <div className="kt-ai-choices" role="group" aria-label="Options">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          className={`kt-ai-choice${o.recommended ? ' kt-ai-choice--rec' : ''}`}
          disabled={!onSend}
          onClick={() => onSend?.(o.label)}
        >
          <span>{o.label}</span>
          {o.recommended ? <small>Recommended</small> : null}
        </button>
      ))}
    </div>
  )
}

export function Thread({
  turns,
  streaming,
  error,
  onRetry,
  onSend,
}: {
  turns: Turn[]
  streaming: boolean
  error: string
  onRetry: () => void
  /** Send a reply (option buttons) */
  onSend?: (text: string) => void
}) {
  const lastIdx = turns.length - 1
  // Animasi masuk hanya untuk pesan yang lahir di sesi ini, bukan riwayat yang baru dimuat
  const [born] = useState(turns.length)
  const fresh = turns.length > born || streaming
  return (
    <>
      {turns.map((t, i) =>
        t.role === 'user' ? (
          <UserBubble key={i} content={t.content} fresh={fresh && i >= lastIdx - 1} />
        ) : (
          <div key={i} className={`kt-ai-answer${fresh && i >= lastIdx - 1 ? ' kt-ai-in' : ''}`}>
            {!t.content ? (
              streaming && i === lastIdx ? (
                <StatusLine key={t.status || 'thinking'} status={t.status || 'thinking'} />
              ) : null
            ) : streaming && i === lastIdx ? (
              <>
                <Markdown text={splitChoices(t.content).body} />
                {t.status ? <StatusLine key={t.status} status={t.status} /> : <IdleStatus content={t.content} />}
              </>
            ) : (
              <Markdown text={splitChoices(t.content).body} />
            )}
            {i === lastIdx && !streaming && t.content ? (
              <ChoiceButtons options={splitChoices(t.content).options} onSend={onSend} />
            ) : null}
            {t.content && !(streaming && i === lastIdx) && tookLabel(turns, i) ? (
              <p className="kt-ai-took">{tookLabel(turns, i)}</p>
            ) : null}
            {t.docs?.length ? <DocCards docs={t.docs} /> : null}
            {i === lastIdx && !streaming && t.content ? (
              <div className="kt-ai-tools">
                <button
                  type="button"
                  aria-label="Copy"
                  title="Copy"
                  onClick={() => void navigator.clipboard?.writeText(splitChoices(t.content).body).then(() => toast.success('Copied.'))}
                >
                  <Icon icon={Copy} size={15} />
                </button>
                <button type="button" aria-label="Try again" title="Try again" onClick={onRetry}>
                  <Icon icon={RotateCcw} size={15} />
                </button>
              </div>
            ) : null}
          </div>
        ),
      )}
      {error ? <BusyCard error={error} onRetry={onRetry} /> : null}
    </>
  )
}

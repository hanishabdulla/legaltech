'use client';

import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { AlertTriangle, ArrowLeft, ArrowUp, Check, Copy, Download, Loader2, Pencil, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ExitButton } from '@/components/cc';
import { Container } from '@/components/page';
import { Banner, Button, Input, Spinner, Textarea } from '@/components/ui';
import { cx, errorMessage, time } from '@/lib/format';
import { useOwnerToken, type DraftOwner } from '@/lib/drafting';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

type Draft = FunctionReturnType<typeof api.drafting.get>;
type FieldRow = Draft['fields'][number];

export default function DraftClient() {
  const params = useSearchParams();
  const kind = (params.get('kind') === 'business' ? 'business' : 'client') as DraftOwner;
  const draftId = (params.get('id') ?? '') as Id<'drafts'>;
  const token = useOwnerToken(kind);
  const d = useQuery(api.drafting.get, token && draftId ? { kind, token, draftId } : 'skip');
  const router = useRouter();
  const home = kind === 'client' ? '/help/' : '/business/';

  useEffect(() => {
    if (token === null) router.replace(home);
  }, [token, router, home]);

  if (!token || d === undefined) return <Spinner label="Opening your document…" />;
  const remedy = kind === 'business';

  return (
    <Container>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={d.caseId ? `/help/case/?id=${d.caseId}` : home} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <span className="text-sm text-faint">·</span>
        <span className="font-mono text-sm text-muted">{d.ref}</span>
        {!remedy ? <div className="ml-auto"><ExitButton /></div> : null}
      </div>
      <div className="mb-6 space-y-2">
        <p className={cx('text-[11px] font-medium tracking-wider uppercase', remedy ? 'text-remedy' : 'text-brand')}>{d.docKind === 'agreement' ? 'Agreement' : 'Letter'}</p>
        <h1 className="font-serif text-3xl font-normal tracking-tight">{d.title}</h1>
      </div>
      {d.warnings.map((w) => (
        <Banner key={w} tone="warn" icon={AlertTriangle} className="mb-4">{w}</Banner>
      ))}
      <div className="grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Chat d={d} kind={kind} token={token} />
        <Side d={d} kind={kind} token={token} />
      </div>
    </Container>
  );
}

function Chat({ d, kind, token }: { d: Draft; kind: DraftOwner; token: string }) {
  const send = useAction(api.drafting.send);
  const generate = useAction(api.drafting.generate);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'send' | 'generate' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const remedy = kind === 'business';

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [d.transcript.length, busy]);

  async function reply(message: string) {
    if (!message.trim() || busy) return;
    setError(null);
    setBusy('send');
    setText('');
    try {
      await send({ kind, token, draftId: d._id, text: message });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function make() {
    setError(null);
    setBusy('generate');
    try {
      await generate({ kind, token, draftId: d._id });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const canMake = d.missing.length === 0;
  const stale = d.status === 'ready' && d.version > 0;

  return (
    <section className="flex min-h-[60vh] flex-col rounded-xl border border-line bg-surface">
      <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5" style={{ maxHeight: '64vh' }}>
        {d.transcript.map((m, i) => (
          <div key={i} className={cx('flex', m.role === 'client' ? 'justify-end' : 'justify-start')}>
            <div className={cx('max-w-[85%] space-y-2', m.role === 'client' && 'text-right')}>
              <div className={cx('inline-block rounded-xl px-4 py-3 text-left', m.role === 'client' ? cx('rounded-br-md text-white', remedy ? 'bg-remedy' : 'bg-brand') : 'rounded-bl-md border border-line bg-bg')}>
                {m.text}
              </div>
              {m.pdf && m.pdfUrl ? <PdfCard url={m.pdfUrl} title={d.title} version={m.pdf.version} pages={m.pdf.pages} latest={m.pdf.version === d.version} /> : null}
              <p className="text-xs text-faint">{time(m.at)}</p>
            </div>
          </div>
        ))}
        {busy ? (
          <div className="inline-flex items-center gap-2 rounded-xl rounded-bl-md border border-line bg-bg px-4 py-3 text-muted">
            <Loader2 className="size-4 animate-spin" /> {busy === 'generate' ? 'Writing your document…' : 'Reading that…'}
          </div>
        ) : null}
        <div ref={end} />
      </div>

      <div className="space-y-3 border-t border-line p-4">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {canMake && d.status !== 'generated' ? (
          <Button size="lg" variant={remedy ? 'remedy' : 'primary'} className="w-full" icon={stale ? RefreshCw : Sparkles} loading={busy === 'generate'} onClick={make}>
            {stale ? 'Create the updated document' : 'Create my document'}
          </Button>
        ) : null}
        {!busy && d.nextField && !canMake ? (
          <div className="flex flex-wrap gap-2">
            {d.nextField.suggestions.map((s) => (
              <button key={s} type="button" onClick={() => reply(s)} className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium hover:bg-bg">{s}</button>
            ))}
          </div>
        ) : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            reply(text);
          }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                reply(text);
              }
            }}
            rows={1}
            placeholder={canMake ? 'Want to change something? Tell me here' : 'Type your answer'}
            className="max-h-36 min-h-12 flex-1 resize-none rounded-xl border border-line bg-surface px-4 py-3 focus:border-brand focus:outline-none"
          />
          <button type="submit" aria-label="Send" disabled={!text.trim() || !!busy} className={cx('flex size-12 items-center justify-center rounded-full text-white disabled:opacity-40', remedy ? 'bg-remedy' : 'bg-brand')}>
            <ArrowUp className="size-5" />
          </button>
        </form>
      </div>
    </section>
  );
}

function PdfCard({ url, title, version, pages, latest }: { url: string; title: string; version: number; pages: number; latest: boolean }) {
  return (
    <div className={cx('flex items-center gap-3 rounded-xl border bg-surface p-3 text-left', latest ? 'border-line shadow-sm' : 'border-line opacity-70')}>
      <span className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md bg-danger-soft text-xs font-medium text-danger">PDF</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="text-sm text-muted">Version {version} · {pages} page{pages === 1 ? '' : 's'}{latest ? '' : ' · older'}</p>
      </div>
      <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-xl bg-bg px-3 py-2 text-sm font-medium hover:bg-line">
        <Download className="size-4" /> Open
      </a>
    </div>
  );
}

function Side({ d, kind, token }: { d: Draft; kind: DraftOwner; token: string }) {
  const remove = useMutation(api.drafting.remove);
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  return (
    <aside className="space-y-6 lg:sticky lg:top-24">
      {d.pdfUrl && d.status === 'generated' ? (
        <a href={d.pdfUrl} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-faint">
          <Download className="size-4 text-ink" />
          <span className="flex-1 text-sm font-medium">Download PDF</span>
          <span className="text-xs text-muted">v{d.version}</span>
        </a>
      ) : null}

      <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Your answers</h2>
          <span className="text-sm text-muted">{d.fields.length - d.missing.length}/{d.fields.length}</span>
        </div>
        <ul className="divide-y divide-line">
          {d.fields.map((f) => <AnswerRow key={f.key} f={f} d={d} kind={kind} token={token} />)}
        </ul>
      </section>

      {d.status === 'generated' ? (
        <section className="space-y-2 rounded-xl border border-line bg-surface p-5">
          <h2 className="font-medium">What to do next</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">{d.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>
      ) : null}

      {d.preview ? (
        <details className="rounded-xl border border-line bg-surface p-5">
          <summary className="cursor-pointer font-medium">Preview the wording</summary>
          <pre className="mt-3 max-h-[50vh] overflow-y-auto font-sans text-sm whitespace-pre-wrap">{d.preview}</pre>
          <Button
            variant="ghost"
            size="sm"
            icon={copied ? Check : Copy}
            className="mt-2"
            onClick={async () => {
              await navigator.clipboard.writeText(d.preview ?? '').catch(() => {});
              setCopied(true);
            }}>
            {copied ? 'Copied' : 'Copy text'}
          </Button>
        </details>
      ) : null}

      <p className="text-sm text-muted">
        {kind === 'client'
          ? 'A template filled in with your details. Show it to Citizens Advice if you’re not sure before you send it.'
          : 'A template filled in with your details. For anything high value or unusual, ask a Remedy lawyer to check it first.'}
      </p>
      <button
        type="button"
        onClick={async () => {
          if (!window.confirm('Delete this document and its PDFs?')) return;
          await remove({ kind, token, draftId: d._id });
          router.replace(kind === 'client' ? '/help/' : '/business/');
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-danger">
        <Trash2 className="size-4" /> Delete this document
      </button>
    </aside>
  );
}

function AnswerRow({ f, d, kind, token }: { f: FieldRow; d: Draft; kind: DraftOwner; token: string }) {
  const setAnswer = useMutation(api.drafting.setAnswer);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const current = d.nextField?.key === f.key;

  function open() {
    setError(null);
    setValue(f.raw === '__blank__' || f.raw === '__skip__' ? '' : f.kind === 'money' && f.raw ? String(Number(f.raw) / 100) : f.raw);
    setEditing(true);
  }

  async function save(v = value) {
    setError(null);
    try {
      await setAnswer({ kind, token, draftId: d._id, key: f.key, value: v });
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <li className="py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm', current ? 'font-medium text-ink' : 'text-muted')}>{f.label}{f.required ? '' : ' (optional)'}</p>
          {!editing ? <p className={cx('text-sm break-words', f.done ? 'font-medium' : 'text-faint')}>{f.done ? f.display : current ? 'Asking now…' : 'Not answered yet'}</p> : null}
        </div>
        {!editing ? (
          <button type="button" aria-label={`Edit ${f.label}`} onClick={open} className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-ink">
            <Pencil className="size-4" />
          </button>
        ) : (
          <button type="button" aria-label="Cancel" onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-muted hover:bg-bg">
            <X className="size-4" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          {f.kind === 'choice' ? (
            <div className="flex flex-wrap gap-1.5">
              {f.options?.map((o) => (
                <button key={o.id} type="button" onClick={() => save(o.id)} className={cx('rounded-full border px-3 py-1.5 text-sm font-medium', f.raw === o.id ? 'border-brand bg-brand text-white' : 'border-line hover:bg-bg')}>
                  {o.label}
                </button>
              ))}
            </div>
          ) : f.kind === 'yesno' ? (
            <div className="flex gap-2">
              <Button size="sm" variant={f.raw === 'yes' ? 'primary' : 'outline'} onClick={() => save('yes')}>Yes</Button>
              <Button size="sm" variant={f.raw === 'no' ? 'primary' : 'outline'} onClick={() => save('no')}>No</Button>
            </div>
          ) : (
            <>
              {f.kind === 'longtext' || f.kind === 'address' ? (
                <Textarea value={value} onChange={(e) => setValue(e.target.value)} className="min-h-24 text-sm" />
              ) : (
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={f.kind === 'date' ? 'e.g. 3 November 2026' : f.kind === 'money' ? 'e.g. 4000' : ''}
                  type={f.kind === 'date' ? 'date' : 'text'}
                  className="h-10 text-sm"
                />
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => save()}>Save</Button>
                {f.placeholderOk || !f.required ? (
                  <Button size="sm" variant="ghost" onClick={() => save('')}>{f.placeholderOk ? 'Leave blank' : 'Skip'}</Button>
                ) : null}
              </div>
            </>
          )}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

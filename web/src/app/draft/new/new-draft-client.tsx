'use client';

import { useAction, useMutation, useQuery } from 'convex/react';
import { ArrowLeft, ArrowRight, FileSignature, FileText, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Container } from '@/components/page';
import { Banner, Button, Check, Spinner, Textarea } from '@/components/ui';
import { cx, errorMessage } from '@/lib/format';
import { draftHref, useOwnerToken, type DraftOwner } from '@/lib/drafting';
import { setToken } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

/** Pick a document, or describe one, then start the drafting chat. */
export default function NewDraftClient() {
  const params = useSearchParams();
  const kind = (params.get('kind') === 'business' ? 'business' : 'client') as DraftOwner;
  const caseId = (params.get('caseId') || undefined) as Id<'cases'> | undefined;
  const preset = params.get('template') ?? undefined;
  const token = useOwnerToken(kind);
  const templates = useQuery(api.drafting.templates, { kind });
  const start = useAction(api.drafting.start);
  const startClient = useMutation(api.sessions.startClient);
  const router = useRouter();

  const [text, setText] = useState(params.get('text') ?? '');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'warn' | 'info'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const auto = useRef(false);
  const remedy = kind === 'business';

  // Businesses must set up first; anonymous clients can start here after consenting.
  useEffect(() => {
    if (remedy && token === null) router.replace('/business/');
  }, [remedy, token, router]);

  async function go(opts: { templateId?: string; text?: string }) {
    setError(null);
    setNotice(null);
    let t = token ?? null;
    if (!t) {
      if (remedy) return;
      if (!consent) return setError('Please tick the box to agree to how we use your information.');
      t = await startClient({ language: 'en' });
      setToken('client', t);
    }
    setBusy(opts.templateId ?? 'text');
    try {
      const res = await start({ kind, token: t, templateId: opts.templateId, text: opts.text, caseId });
      if (res.status === 'started') return router.replace(draftHref(kind, res.draftId));
      setNotice({ tone: res.status === 'unsupported' ? 'warn' : 'info', text: res.message });
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(null);
  }

  // "Write this letter with me" links come with a template already chosen.
  useEffect(() => {
    if (preset && token && !auto.current) {
      auto.current = true;
      queueMicrotask(() => go({ templateId: preset }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, token]);

  if (token === undefined || (preset && token && busy !== null)) return <Spinner label="Starting your document…" />;

  return (
    <Container narrow>
      <Link href={caseId ? `/help/case/?id=${caseId}` : remedy ? '/business/' : '/help/'} className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </Link>
      <div className="space-y-3">
        <span className={cx('flex size-12 items-center justify-center rounded-xl text-white', remedy ? 'bg-remedy' : 'bg-brand')}><FileSignature className="size-6" /></span>
        <h1 className="font-serif text-3xl font-normal tracking-tight">{remedy ? 'Draft a document' : 'Write a letter'}</h1>
        <p className="text-base leading-relaxed text-muted">
          Tell me what you need, or pick one below. I’ll ask a few questions and make a PDF you can download, edit and re-create.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={remedy ? 'e.g. An NDA before we share designs with a printer' : 'e.g. A letter to my landlord about damp and a broken boiler'}
          className="min-h-24"
        />
        <Button variant={remedy ? 'remedy' : 'primary'} icon={ArrowRight} loading={busy === 'text'} disabled={!text.trim() || !!busy} onClick={() => go({ text })}>
          Start drafting
        </Button>
      </div>

      {notice ? (
        <Banner tone={notice.tone} icon={notice.tone === 'warn' ? ShieldAlert : undefined} className="mt-6">{notice.text}</Banner>
      ) : null}
      {error ? <Banner tone="danger" className="mt-6">{error}</Banner> : null}

      <div className="mt-10 space-y-3">
        <p className="text-[11px] font-medium tracking-wider text-muted uppercase">Or choose</p>
        {templates === undefined ? (
          <Spinner className="py-6" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={!!busy}
                onClick={() => go({ templateId: t.id })}
                className="flex gap-3 rounded-xl border border-line bg-surface p-4 text-left transition hover:border-faint disabled:opacity-50">
                <FileText className={cx('mt-0.5 size-5 shrink-0', remedy ? 'text-remedy' : 'text-brand')} />
                <span>
                  <span className="block font-medium">{t.title}</span>
                  <span className="block text-sm text-muted">{t.short}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!remedy && !token ? (
        <div className="mt-8 rounded-xl border border-line bg-surface p-5">
          <Check
            checked={consent}
            onChange={setConsent}
            label="I agree that Remedy can save the details I put in my letter, so I can edit it later. I can delete it at any time."
          />
        </div>
      ) : null}

      <p className="mt-8 text-sm text-muted">
        We can’t draft wills, probate or property documents, leases, court forms, divorce papers or powers of attorney. We’ll tell you where to get help with those.
      </p>
    </Container>
  );
}

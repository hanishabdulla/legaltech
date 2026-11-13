'use client';

import { useMutation, useQuery } from 'convex/react';
import { ArrowRight, ChevronRight, Clock, CloudOff, FileText, Flame, Phone, Scissors, ShieldCheck, ShoppingBasket, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CASE_STATUS, ExitButton, LANGUAGES, caseHref } from '@/components/cc';
import { Container } from '@/components/page';
import { Banner, Button, Card, Check, Chip, Spinner, Textarea } from '@/components/ui';
import { draftHref, newDraftHref } from '@/lib/drafting';
import { errorMessage, shortDate } from '@/lib/format';
import { setToken, useToken } from '@/lib/session';
import { api } from '@convex/_generated/api';

const QUICK = [
  { icon: Scissors, text: 'My benefits were sanctioned or cut' },
  { icon: Clock, text: 'My Universal Credit is late' },
  { icon: Flame, text: 'I can’t top up my gas or electric' },
  { icon: ShoppingBasket, text: 'I have no food' },
];

const PRIVACY = [
  'We don’t ask for your name, NI number or address to get started.',
  'We keep only the first part of your postcode.',
  'AI helps organise what you tell us. It never sees your name or contact details, and it never decides if you get help: the rules and an adviser do.',
  'An adviser only sees your case once you send it to them.',
  'You can delete everything from this page at any time.',
];

export default function HelpStart() {
  const token = useToken('client');
  const me = useQuery(api.sessions.client, token ? { token } : 'skip');
  const live = !!token && !!me;
  const cases = useQuery(api.cases.mine, live ? { token: token! } : 'skip');
  const vouchers = useQuery(api.vouchers.list, live ? { token: token! } : 'skip');
  const drafts = useQuery(api.drafting.mine, live ? { kind: 'client', token: token! } : 'skip');
  const startClient = useMutation(api.sessions.startClient);
  const createCase = useMutation(api.cases.create);
  const setLanguageRemote = useMutation(api.sessions.setLanguage);
  const deleteMyData = useMutation(api.sessions.deleteMyData);
  const router = useRouter();

  const [localLanguage, setLocalLanguage] = useState('en');
  const language = me?.language ?? localLanguage;
  const [story, setStory] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drop a saved session the server no longer knows (e.g. after deleting data).
  useEffect(() => {
    if (token && me === null) setToken('client', null);
  }, [token, me]);

  if (token === undefined) return <Spinner />;

  async function begin(text: string, mode: 'chat' | 'steps') {
    setError(null);
    if (!live && !consent) return setError('Please tick the box to agree to how we use your information.');
    setBusy(mode === 'steps' ? 'steps' : text);
    try {
      let t = live ? token! : null;
      if (!t) {
        t = await startClient({ language });
        setToken('client', t);
      }
      const caseId = await createCase({ token: t, story: text });
      router.push(mode === 'steps' ? `/help/steps/?id=${caseId}` : caseHref(caseId));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  async function chooseLanguage(id: string) {
    setLocalLanguage(id);
    if (live) await setLanguageRemote({ token: token!, language: id }).catch(() => {});
  }

  async function wipe() {
    if (!window.confirm('Delete my data?\n\nThis permanently deletes everything you’ve told us, your documents and your vouchers.')) return;
    if (token) await deleteMyData({ token }).catch(() => {});
    setToken('client', null);
  }

  return (
    <Container>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l.id} selected={language === l.id} onClick={() => chooseLanguage(l.id)}>{l.label}</Chip>
          ))}
        </div>
        <ExitButton />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-6">
          <div className="space-y-3">
            <h1 className="font-serif text-4xl font-normal tracking-tight text-balance sm:text-5xl">What’s happened?</h1>
            <p className="text-base leading-relaxed text-muted">Tell us in your own words. No account, no forms. We’ll ask a few questions and get it ready for an adviser.</p>
          </div>

          <div className="space-y-3">
            <Textarea
              value={story}
              onChange={(e) => setStory(e.target.value.slice(0, 2000))}
              placeholder="For example: I was sanctioned last week, I’ve got £40 left and my meter is on emergency credit."
              className="min-h-36 text-lg"
            />
            <Button size="lg" className="w-full sm:w-auto" icon={ArrowRight} onClick={() => begin(story.trim(), 'chat')} disabled={!story.trim() || !!busy} loading={!!story.trim() && busy === story.trim()}>
              Continue
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-medium tracking-wider text-muted uppercase">Or start with</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK.map((q) => (
                <button
                  key={q.text}
                  type="button"
                  disabled={!!busy}
                  onClick={() => begin(q.text, 'chat')}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left font-medium transition-colors hover:border-brand hover:bg-brand-soft disabled:opacity-50">
                  <q.icon className="size-5 shrink-0 text-brand" />
                  <span className="flex-1">{q.text}</span>
                  <ArrowRight className="size-4 text-faint" />
                </button>
              ))}
            </div>
          </div>

          {!live ? (
            <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
              <Check
                checked={consent}
                onChange={setConsent}
                label="I agree that Common Counsel can save what I share, including health information like food needs, so an adviser can help me. I can delete it at any time."
              />
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-brand">How we use your information</summary>
                <ul className="mt-3 space-y-2">
                  {PRIVACY.map((p) => (
                    <li key={p} className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />{p}</li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}

          {error ? <Banner tone="danger">{error}</Banner> : null}
          <button type="button" onClick={() => begin('', 'steps')} disabled={!!busy} className="text-sm font-medium text-brand underline underline-offset-2">
            Answer step by step instead
          </button>
        </section>

        <aside className="space-y-6">
          <Banner tone="danger" icon={Phone} title="In danger right now?">
            Call 999. National Domestic Abuse Helpline: <a className="font-medium underline" href="tel:08082000247">0808 2000 247</a> (free, 24 hours).
          </Banner>

          <Link href={newDraftHref('client')} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5 hover:border-faint">
            <span className="flex-1">
              <span className="block font-medium">Need a letter written?</span>
              <span className="block text-sm text-muted">Benefits, repairs, deposits, debts or your data.</span>
            </span>
            <ChevronRight className="size-4 text-faint" />
          </Link>

          {drafts?.length ? (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-ink">Your letters</h2>
              {drafts.map((d) => (
                <Link key={d._id} href={draftHref('client', d._id)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-faint">
                  <FileText className="size-5 shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.title}</p>
                    <p className="text-sm text-muted">{d.status === 'generated' ? `PDF ready · version ${d.version}` : 'In progress'} · {shortDate(d.updatedAt)}</p>
                  </div>
                  <ChevronRight className="size-4 text-faint" />
                </Link>
              ))}
            </div>
          ) : null}

          {live ? (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-ink">Your cases</h2>
              {cases === undefined ? (
                <Spinner className="py-6" />
              ) : cases.length === 0 ? (
                <p className="text-sm text-muted">Nothing yet. Tell us what’s happened to start.</p>
              ) : (
                cases.map((c) => (
                  <Link key={c._id} href={caseHref(c._id)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-faint">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.story || 'Step-by-step check'}</p>
                      <p className="text-sm text-muted">{CASE_STATUS[c.status]} · {shortDate(c.createdAt)}</p>
                    </div>
                    <ChevronRight className="size-4 text-faint" />
                  </Link>
                ))
              )}
              {vouchers?.length ? (
                <Link href="/help/wallet/" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-sm font-medium hover:border-faint">
                  <Wallet className="size-4" /> Vouchers <span className="text-muted">{vouchers.length}</span> <ChevronRight className="ml-auto size-4 text-faint" />
                </Link>
              ) : null}
              <button type="button" onClick={wipe} className="text-sm font-medium text-danger underline underline-offset-2">Delete my data</button>
            </div>
          ) : (
            <Card className="space-y-3">
              <h2 className="font-medium">What happens next</h2>
              <ol className="space-y-2 text-sm text-muted">
                <li>1. You tell us what’s happened, at any hour.</li>
                <li>2. We check the Leeds Crisis Payment, food bank and fuel criteria.</li>
                <li>3. An adviser approves the help, usually the same day.</li>
                <li>4. We show what to do about the cause, with any deadlines.</li>
              </ol>
            </Card>
          )}
          <p className="flex gap-2 text-sm text-muted"><CloudOff className="mt-0.5 size-4 shrink-0" /> Prototype. Information, not legal advice.</p>
        </aside>
      </div>
    </Container>
  );
}

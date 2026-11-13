'use client';

import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { AlarmClock, ArrowLeft, ArrowRight, CheckCheck, FileSignature, Copy, FileText, Phone, Undo2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AiBadge, ExitButton, NotAdvice, caseHref } from '@/components/cc';
import { Container, useIdParam } from '@/components/page';
import { Button, Empty, Spinner } from '@/components/ui';
import { newDraftHref } from '@/lib/drafting';
import { cx, daysLeft, longDate } from '@/lib/format';
import { useToken } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

type Action = FunctionReturnType<typeof api.cases.get>['actions'][number];

export default function PlanClient() {
  const caseId = useIdParam<Id<'cases'>>();
  const token = useToken('client');
  const c = useQuery(api.cases.get, token && caseId ? { token, caseId } : 'skip');
  const setStatus = useMutation(api.cases.setActionStatus);
  const router = useRouter();

  useEffect(() => {
    if (token === null) router.replace('/help/');
  }, [token, router]);

  if (!token || c === undefined) return <Spinner />;

  return (
    <Container narrow>
      <div className="mb-6 flex items-center justify-between">
        <Link href={caseHref(caseId)} className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Back to your case
        </Link>
        <ExitButton />
      </div>
      <div className="space-y-3">
        <AiBadge approved={c.status === 'approved'} />
        <h1 className="font-serif text-3xl font-normal tracking-tight">Sorting out the cause</h1>
        <p className="text-base leading-relaxed text-muted">Steps to deal with what caused the crisis, so it doesn’t happen again.</p>
      </div>
      <div className="mt-8 space-y-4">
        {c.actions.length === 0 ? (
          <Empty icon={CheckCheck} title="Nothing else to do right now" text="If things change, start a new case or call Leeds Citizens Advice on 0808 278 7878." />
        ) : (
          c.actions.map((a) => <ActionCard key={a._id} a={a} caseId={caseId} onStatus={(status) => setStatus({ token, actionId: a._id, status })} />)
        )}
      </div>
      <div className="mt-8"><NotAdvice /></div>
    </Container>
  );
}

function ActionCard({ a, caseId, onStatus }: { a: Action; caseId: string; onStatus: (s: 'todo' | 'done') => void }) {
  const [showLetter, setShowLetter] = useState(false);
  const [copied, setCopied] = useState(false);
  const done = a.status === 'done';
  const left = a.deadline ? daysLeft(a.deadline) : null;

  return (
    <article className={cx('space-y-4 rounded-xl border border-line bg-surface p-5', done && 'opacity-70')}>
      <div>
        <h2 className="text-sm font-medium text-ink">{a.title}</h2>
        <p className="mt-1 text-muted">{a.detail}</p>
      </div>
      {a.deadline && left !== null ? (
        <div className={cx('flex items-center gap-4 rounded-xl p-4', left <= 7 ? 'bg-danger-soft' : 'bg-warn-soft')}>
          <div className={cx('text-center', left <= 7 ? 'text-danger' : 'text-warn')}>
            <p className="font-serif text-3xl font-normal">{left}</p>
            <p className="text-xs font-medium">{left === 1 ? 'day' : 'days'}</p>
          </div>
          <div>
            <p className="inline-flex items-center gap-1.5 font-medium"><AlarmClock className="size-4" /> Deadline: {longDate(a.deadline)}</p>
            {a.deadlineBasis ? <p className="text-sm text-muted">{a.deadlineBasis}</p> : null}
          </div>
        </div>
      ) : a.deadlineBasis ? (
        <p className="rounded-xl bg-warn-soft p-3 text-sm">{a.deadlineBasis}</p>
      ) : null}

      {a.draftLetter ? (
        <div className="space-y-3">
          {a.type === 'mandatory_reconsideration' ? (
            <Link href={newDraftHref('client', { caseId, template: 'mandatory_reconsideration' })} className="flex items-center gap-3 rounded-xl bg-brand p-4 font-medium text-white">
              <FileSignature className="size-5" /> <span className="flex-1">Write this letter with me and get a PDF</span> <ArrowRight className="size-4" />
            </Link>
          ) : null}
          <Button variant="secondary" icon={FileText} onClick={() => setShowLetter(!showLetter)}>{showLetter ? 'Hide the template' : 'See the template'}</Button>
          {showLetter ? (
            <>
              <pre className="rounded-xl bg-bg p-4 font-sans text-sm whitespace-pre-wrap">{a.draftLetter}</pre>
              <p className="text-sm text-muted">Fixed template: the pilot has it reviewed by a partner law firm first. Fill in the parts in [brackets].</p>
              <Button
                variant="ghost"
                icon={Copy}
                onClick={async () => {
                  await navigator.clipboard.writeText(a.draftLetter!).catch(() => {});
                  setCopied(true);
                }}>
                {copied ? 'Copied' : 'Copy letter'}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {a.handoffTo ? (
        <div className="flex items-center gap-3 rounded-xl bg-info-soft p-3">
          <Users className="size-5 shrink-0 text-info" />
          <div className="flex-1 text-sm">
            <p className="font-medium">Free help: {a.handoffTo}</p>
            {a.handoffContact ? <p className="text-muted">{a.handoffContact}</p> : null}
          </div>
          {a.handoffContact ? (
            <a href={`tel:${a.handoffContact.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-info hover:bg-white/60">
              <Phone className="size-4" /> Call
            </a>
          ) : null}
        </div>
      ) : null}

      <Button variant="ghost" icon={done ? Undo2 : CheckCheck} onClick={() => onStatus(done ? 'todo' : 'done')}>
        {done ? 'Mark as not done' : 'I’ve done this'}
      </Button>
    </article>
  );
}

'use client';

import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Coffee, LogOut, Timer, Zap } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/page';
import { FlagChips, StatusBadge, TOPIC_LABELS, useNow } from '@/components/remedy';
import { StaffSignIn } from '@/components/staff-signin';
import { Button, Empty, Pill, Spinner, Stat } from '@/components/ui';
import { cx, dueLabel, shortDate } from '@/lib/format';
import { useStaff } from '@/lib/staff';
import { api } from '@convex/_generated/api';

type Row = FunctionReturnType<typeof api.lawyer.queue>['open'][number];

export default function LawyerPage() {
  const s = useStaff('lawyer');
  if (s.state === 'loading') return <Spinner />;
  if (s.state === 'signedOut') return <StaffSignIn role="lawyer" />;
  return <Queue token={s.token} name={s.me.name} onSignOut={s.signOut} />;
}

function Queue({ token, name, onSignOut }: { token: string; name: string; onSignOut: () => void }) {
  const queue = useQuery(api.lawyer.queue, { token });
  const signOut = useMutation(api.sessions.staffSignOut);
  const now = useNow();
  const waiting = queue?.open.filter((m) => m.status === 'in_review') ?? [];
  const overdue = waiting.filter((m) => m.dueAt && m.dueAt < now).length;

  return (
    <Container>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-remedy">Remedy · lawyer</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Review queue</h1>
          <p className="text-muted">Signed in as {name}. High urgency first, then oldest. Updates live.</p>
        </div>
        <Button variant="outline" icon={LogOut} onClick={async () => { await signOut({ token }).catch(() => {}); onSignOut(); }}>Sign out</Button>
      </div>
      {queue === undefined ? (
        <Spinner />
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-4 md:max-w-3xl md:grid-cols-4">
            <Stat label="To review" value={waiting.length} />
            <Stat label="High urgency" value={waiting.filter((m) => m.urgency === 'high').length} tone="danger" />
            <Stat label="Overdue" value={overdue} tone={overdue ? 'danger' : undefined} />
            <Stat label="Awaiting client" value={queue.open.length - waiting.length} tone="warn" />
          </div>
          <section className="space-y-4">
            <h2 className="text-lg font-bold">Open matters</h2>
            {queue.open.length === 0 ? (
              <Empty icon={Coffee} title="Queue is clear" text="Flagged matters appear here live when a founder asks a question." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{queue.open.map((m) => <QueueCard key={m._id} m={m} now={now} />)}</div>
            )}
          </section>
          {queue.recent.length ? (
            <section className="space-y-4">
              <h2 className="text-lg font-bold">Recently checked</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{queue.recent.map((m) => <QueueCard key={m._id} m={m} now={now} />)}</div>
            </section>
          ) : null}
        </div>
      )}
    </Container>
  );
}

function QueueCard({ m, now }: { m: Row; now: number }) {
  const due = m.status === 'in_review' ? dueLabel(m.dueAt, now) : null;
  const hot = m.status === 'in_review' && (m.urgency === 'high' || due?.overdue);
  return (
    <Link href={`/lawyer/matter/?id=${m._id}`} className={cx('flex flex-col gap-3 rounded-2xl border bg-surface p-5 transition hover:shadow-sm', hot ? 'border-[1.5px] border-danger' : 'border-line hover:border-faint')}>
      <div className="flex flex-wrap items-center gap-2">
        {m.urgency === 'high' ? <Pill tone="danger" icon={Zap}>High urgency</Pill> : null}
        <StatusBadge status={m.status} />
        <span className="ml-auto text-xs text-muted">{m.ref} · {shortDate(m.createdAt)}</span>
      </div>
      <p className="text-sm text-muted">{m.business} · {TOPIC_LABELS[m.topic] ?? m.topic}</p>
      <div className="space-y-0.5">
        {m.lines.map((l, i) => <p key={i} className={cx('line-clamp-2', i === 0 ? 'font-semibold' : 'text-sm text-muted')}>{l}</p>)}
      </div>
      <FlagChips codes={m.flagCodes} />
      {due ? <p className={cx('inline-flex items-center gap-1 text-sm font-bold', due.overdue ? 'text-danger' : 'text-muted')}><Timer className="size-4" /> {due.text}</p> : null}
    </Link>
  );
}

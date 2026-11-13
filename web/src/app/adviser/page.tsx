'use client';

import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Coffee, Flag, LogOut } from 'lucide-react';
import Link from 'next/link';

import { OutcomePill, type Outcome } from '@/components/cc';
import { Container } from '@/components/page';
import { StaffSignIn } from '@/components/staff-signin';
import { Button, Empty, Pill, Spinner, Stat } from '@/components/ui';
import { cx, shortDate } from '@/lib/format';
import { useStaff } from '@/lib/staff';
import { api } from '@convex/_generated/api';

type Row = FunctionReturnType<typeof api.adviser.queue>['open'][number];

export default function AdviserPage() {
  const s = useStaff('staff');
  if (s.state === 'loading') return <Spinner />;
  if (s.state === 'signedOut') return <StaffSignIn role="adviser" />;
  return <Queue token={s.token} name={s.me.name} org={s.me.organisation} onSignOut={s.signOut} />;
}

function Queue({ token, name, org, onSignOut }: { token: string; name: string; org: string; onSignOut: () => void }) {
  const queue = useQuery(api.adviser.queue, { token });
  const signOut = useMutation(api.sessions.staffSignOut);

  return (
    <Container>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-wider text-brand uppercase">Common Counsel · {org}</p>
          <h1 className="font-serif text-3xl font-normal tracking-tight">Adviser queue</h1>
          <p className="text-sm text-muted">{name}</p>
        </div>
        <Button variant="outline" icon={LogOut} onClick={async () => { await signOut({ token }).catch(() => {}); onSignOut(); }}>Sign out</Button>
      </div>
      {queue === undefined ? (
        <Spinner />
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-3 gap-4 sm:max-w-xl">
            <Stat label="Waiting" value={queue.open.length} />
            <Stat label="Urgent" value={queue.open.filter((c) => c.urgency === 'urgent').length} tone="danger" />
            <Stat label="Decided" value={queue.recent.length} tone="brand" />
          </div>
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-ink">To review</h2>
            {queue.open.length === 0 ? (
              <Empty icon={Coffee} title="Queue is clear" text="New cases appear here live when someone sends theirs." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{queue.open.map((c) => <QueueCard key={c._id} c={c} />)}</div>
            )}
          </section>
          {queue.recent.length ? (
            <section className="space-y-4">
              <h2 className="text-sm font-medium text-ink">Recently decided</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{queue.recent.map((c) => <QueueCard key={c._id} c={c} />)}</div>
            </section>
          ) : null}
        </div>
      )}
    </Container>
  );
}

function QueueCard({ c }: { c: Row }) {
  const lines = c.adviserSummary.split('\n').filter(Boolean).slice(0, 3);
  return (
    <Link
      href={`/adviser/case/?id=${c._id}`}
      className={cx('flex flex-col gap-3 rounded-xl border bg-surface p-5 transition', c.urgency === 'urgent' ? 'border-danger/40' : 'border-line hover:border-faint')}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={c.safeguarding || c.urgency === 'urgent' ? 'danger' : c.pending ? 'warn' : 'brand'}>
          {c.safeguarding ? 'Safeguarding' : c.urgency === 'urgent' ? 'Urgent' : c.pending ? `${c.pending} to decide` : c.status.replace('_', ' ')}
        </Pill>
        <span className="ml-auto text-xs text-muted">{shortDate(c.submittedAt)}</span>
      </div>
      <div className="space-y-0.5">
        {lines.map((l, i) => <p key={i} className={i === 0 ? 'font-medium' : 'text-sm text-muted'}>{l}</p>)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {c.outcomes.map((o) => (
          <span key={o.scheme} className="inline-flex items-center gap-1 text-xs text-muted">{o.name} <OutcomePill outcome={o.outcome as Outcome} /></span>
        ))}
      </div>
      {c.flags.length ? <p className="inline-flex items-center gap-1 text-sm text-warn"><Flag className="size-3.5" /> {c.flags[0]}{c.flags.length > 1 ? ` (+${c.flags.length - 1})` : ''}</p> : null}
    </Link>
  );
}

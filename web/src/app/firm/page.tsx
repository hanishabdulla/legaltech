'use client';

import { useMutation, useQuery } from 'convex/react';
import { Inbox, LogOut } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/page';
import { REFERRAL_STATUS, TRIGGER_LABEL } from '@/components/remedy';
import { StaffSignIn } from '@/components/staff-signin';
import { Button, Empty, Pill, Spinner } from '@/components/ui';
import { cx, dateTime } from '@/lib/format';
import { useStaff } from '@/lib/staff';
import { api } from '@convex/_generated/api';

export default function FirmPage() {
  const s = useStaff('firm');
  if (s.state === 'loading') return <Spinner />;
  if (s.state === 'signedOut') return <StaffSignIn role="firm" />;
  return <FirmInbox token={s.token} name={s.me.name} onSignOut={s.signOut} />;
}

function FirmInbox({ token, name, onSignOut }: { token: string; name: string; onSignOut: () => void }) {
  const inbox = useQuery(api.firms.inbox, { token });
  const signOut = useMutation(api.sessions.staffSignOut);

  return (
    <Container>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-wider text-remedy uppercase">Remedy partner portal</p>
          <h1 className="font-serif text-3xl font-normal tracking-tight">{inbox?.firm?.name ?? 'Partner firm'}</h1>
          <p className="text-sm text-muted">{name}</p>
        </div>
        <Button variant="outline" icon={LogOut} onClick={async () => { await signOut({ token }).catch(() => {}); onSignOut(); }}>Sign out</Button>
      </div>
      {inbox === undefined ? (
        <Spinner />
      ) : inbox.referrals.length === 0 ? (
        <Empty icon={Inbox} title="No referrals yet" text="When a Remedy client chooses your firm and consents to share, their pack appears here live." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {inbox.referrals.map((r) => {
            const st = REFERRAL_STATUS[r.status];
            return (
              <Link key={r._id} href={`/firm/referral/?id=${r._id}`} className={cx('space-y-3 rounded-xl border bg-surface p-5 transition', r.status === 'sent' ? 'border-info/40' : 'border-line hover:border-faint')}>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={st.tone}>{st.text}</Pill>
                  <span className="text-xs text-muted">{TRIGGER_LABEL[r.trigger]}</span>
                  <span className="ml-auto text-xs text-muted">{dateTime(r.createdAt)}</span>
                </div>
                <p className="font-serif text-xl">{r.business}</p>
                <p className="line-clamp-2 text-sm text-muted">{r.reason}</p>
                <p className="text-xs text-muted">{r.matters} matter{r.matters === 1 ? '' : 's'} · {r.documents} document{r.documents === 1 ? '' : 's'}</p>
              </Link>
            );
          })}
        </div>
      )}
    </Container>
  );
}

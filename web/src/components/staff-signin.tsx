'use client';

import { useMutation, useQuery } from 'convex/react';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';

import { Container } from '@/components/page';
import { Banner, Button, Chip, Field, Input, Option } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { setToken, type TokenKind } from '@/lib/session';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

const ORGS = ['Leeds Citizens Advice', 'Community Hub (Harehills)', 'Uni law clinic'];

const COPY = {
  adviser: {
    sub: 'Common Counsel',
    title: 'Adviser sign in',
    text: 'Review cases, approve referrals and edit case notes.',
    code: 'LEEDS',
  },
  lawyer: {
    sub: 'Remedy',
    title: 'Lawyer portal',
    text: 'Review flagged matters, edit AI drafts and recommend partner firms.',
    code: 'REMEDY',
  },
  firm: {
    sub: 'Remedy',
    title: 'Partner firm',
    text: 'Review and respond to client handoff packs.',
    code: 'REMEDY',
  },
} as const;

/** Demo staff sign-in. The pilot replaces this with Convex Auth. */
export function StaffSignIn({ role }: { role: 'adviser' | 'lawyer' | 'firm' }) {
  const adviserSignIn = useMutation(api.sessions.staffSignIn);
  const remedySignIn = useMutation(api.sessions.remedyStaffSignIn);
  const panel = useQuery(api.firms.panel, role === 'firm' ? {} : 'skip');
  const [name, setName] = useState('');
  const [org, setOrg] = useState(ORGS[0]);
  const [firmId, setFirmId] = useState<Id<'partnerFirms'> | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[role];
  const kind: TokenKind = role === 'adviser' ? 'staff' : role;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const token =
        role === 'adviser'
          ? await adviserSignIn({ name, organisation: org, code })
          : await remedySignIn({ name, code, role, firmId: firmId ?? undefined });
      setToken(kind, token);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Container narrow>
      <form onSubmit={submit} className="mx-auto max-w-md space-y-6 rounded-xl border border-line bg-surface p-6 sm:p-8">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted">{copy.sub}</p>
          <h1 className="font-serif text-3xl font-medium tracking-tight">{copy.title}</h1>
          <p className="text-sm text-muted">{copy.text}</p>
        </div>
        <Field label="Your name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" />
        </Field>
        {role === 'adviser' ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Organisation</p>
            <div className="flex flex-wrap gap-1.5">{ORGS.map((o) => <Chip key={o} selected={org === o} onClick={() => setOrg(o)}>{o}</Chip>)}</div>
          </div>
        ) : null}
        {role === 'firm' ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Your firm</p>
            {panel?.length === 0 ? <Banner tone="warn">No panel firms yet. Run <code>npx convex run seed:run</code>.</Banner> : null}
            {panel?.map((f) => <Option key={f._id} label={f.name} hint={`${f.city} · ${f.licence}`} selected={firmId === f._id} onClick={() => setFirmId(f._id)} />)}
          </div>
        ) : null}
        <Field label="Access code" hint={`Demo code: ${copy.code}`}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={copy.code} autoCapitalize="characters" />
        </Field>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button type="submit" size="lg" className="w-full" variant={role === 'adviser' ? 'primary' : 'remedy'} icon={ArrowRight} loading={busy} disabled={!name.trim() || !code.trim() || (role === 'firm' && !firmId)}>
          Sign in
        </Button>
      </form>
    </Container>
  );
}

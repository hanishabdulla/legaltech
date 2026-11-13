'use client';

import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ArrowLeft, CheckCheck, Eye, EyeOff, Undo2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { AiBadge, ExitButton, RETAILER_COLORS, StatusPill, VoucherCard } from '@/components/cc';
import { Container } from '@/components/page';
import { Button, Empty, Spinner } from '@/components/ui';
import { daysLeft, groupCode, longDate, money, voucherStatus } from '@/lib/format';
import { useToken } from '@/lib/session';
import { api } from '@convex/_generated/api';

type Voucher = FunctionReturnType<typeof api.vouchers.list>[number];

export default function WalletClient() {
  const token = useToken('client');
  const vouchers = useQuery(api.vouchers.list, token ? { token } : 'skip');
  const selectedId = useSearchParams().get('v');
  const router = useRouter();

  useEffect(() => {
    if (token === null) router.replace('/help/');
  }, [token, router]);

  if (!token || vouchers === undefined) return <Spinner />;

  const active = vouchers.filter((v) => voucherStatus(v) === 'active').sort((a, b) => a.expiresAt - b.expiresAt);
  const past = vouchers.filter((v) => voucherStatus(v) !== 'active');
  const total = active.reduce((s, v) => s + v.valuePence, 0);
  const selected = vouchers.find((v) => v._id === selectedId) ?? active[0] ?? null;

  return (
    <Container>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/help/" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="size-4" /> Back</Link>
        <ExitButton />
      </div>
      <div className="mb-8 space-y-1">
        <p className="text-xs font-bold tracking-wider text-muted uppercase">Available to spend</p>
        <p className="text-5xl font-extrabold tracking-tight">{money(total)}</p>
        <p className="text-muted">Illustrative amounts for the demo. Vouchers only appear after an adviser approves.</p>
      </div>

      {vouchers.length === 0 ? (
        <Empty icon={Wallet} title="Nothing here yet" text="Vouchers appear here once an adviser approves your referral." />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            {active.length ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Active</h2><AiBadge approved /></div>
                {active.map((v) => <VoucherCard key={v._id} voucher={v} href={`/help/wallet/?v=${v._id}`} />)}
              </div>
            ) : null}
            {past.length ? (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">Used and expired</h2>
                {past.map((v) => <VoucherCard key={v._id} compact voucher={v} href={`/help/wallet/?v=${v._id}`} />)}
              </div>
            ) : null}
          </div>
          {selected ? <VoucherDetail key={selected._id} v={selected} token={token} /> : null}
        </div>
      )}
    </Container>
  );
}

function VoucherDetail({ v, token }: { v: Voucher; token: string }) {
  const setUsed = useMutation(api.vouchers.setUsed);
  const [showPin, setShowPin] = useState(false);
  const status = voucherStatus(v);
  const color = status === 'active' ? (RETAILER_COLORS[v.retailer] ?? '#0e6b4e') : '#8d9792';
  const food = v.kind === 'food';
  const steps = food
    ? [`Go to any ${v.retailer} store.`, 'At the till, say you have an e-voucher and show this screen.', 'They scan the code. Turn your screen brightness up if it doesn’t scan.', 'It can’t be used for alcohol, tobacco or lottery tickets.']
    : ['Take this code to any shop with a PayPoint or Payzone sign.', 'Bring your prepayment key or card.', 'The shop adds the credit, then top up your meter as usual.'];

  return (
    <section className="space-y-5 lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-line">
        <div className="space-y-1 p-6 text-white" style={{ backgroundColor: color }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider uppercase">{food ? 'Food voucher' : 'Energy top-up'}</span>
            <StatusPill status={status} left={daysLeft(v.expiresAt)} />
          </div>
          <p className="font-semibold text-white/90">{v.retailer}</p>
          <p className="text-5xl font-extrabold tracking-tight">{money(v.valuePence)}</p>
        </div>
        <div className="flex flex-col items-center gap-3 border-t-2 border-dashed border-line p-6">
          <div className={status === 'active' ? '' : 'opacity-25'}>
            <QRCodeSVG value={v.code} size={176} />
          </div>
          <p className="text-xs font-bold tracking-wider text-muted uppercase">Voucher code</p>
          <p className="font-mono text-xl font-bold tracking-wider tabular-nums">{groupCode(v.code)}</p>
          <button type="button" onClick={() => setShowPin(!showPin)} className="inline-flex items-center gap-2 rounded-full bg-bg px-4 py-2 text-sm">
            PIN <span className="font-bold tracking-[0.3em]">{showPin ? v.pin : '••••'}</span>
            {showPin ? <EyeOff className="size-4 text-muted" /> : <Eye className="size-4 text-muted" />}
          </button>
        </div>
      </div>

      <dl className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
        {[
          ['Status', status === 'active' ? 'Ready to use' : status === 'used' ? 'Used' : 'Expired'],
          ['Issued', longDate(v.issuedAt)],
          ['Valid until', longDate(v.expiresAt)],
          ...(v.usedAt ? [['Marked used', longDate(v.usedAt)]] : []),
          ['Value (illustrative)', money(v.valuePence)],
        ].map(([k, val]) => (
          <div key={k} className="flex justify-between px-4 py-3">
            <dt className="text-muted">{k}</dt>
            <dd className="font-semibold">{val}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2">
        <h3 className="font-bold">How to use it</h3>
        <ol className="space-y-2 text-sm">
          {steps.map((s, i) => (
            <li key={s} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>{s}</li>
          ))}
        </ol>
      </div>
      {status !== 'expired' ? (
        <Button variant={status === 'used' ? 'ghost' : 'secondary'} icon={status === 'used' ? Undo2 : CheckCheck} onClick={() => setUsed({ token, voucherId: v._id, used: status !== 'used' })}>
          {status === 'used' ? 'Mark as not used' : 'I’ve used this voucher'}
        </Button>
      ) : null}
      <p className="text-center text-sm text-muted">Demo voucher with an illustrative amount. It can’t be used in a real shop.</p>
    </section>
  );
}

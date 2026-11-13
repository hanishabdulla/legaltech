import { describe, expect, test } from 'vitest';
import { BLANK, SKIP, activeFields, addMonths, fallbackParse, missingFields, normalise, type Answers, type Field } from './fields';
import { toPlainText } from './model';
import { renderPdf } from './pdf';
import { OUT_OF_SCOPE, TEMPLATES, helpers, lateCompensationPence, looksLikeDraftRequest } from './templates';

const TODAY = '2026-11-13';

/** A plausible answer for every field kind. */
function sample(f: Field): string {
  switch (f.kind) {
    case 'name':
      return 'Maya Ahmed';
    case 'text':
      return 'Example text';
    case 'longtext':
      return 'I was in hospital on the day of the appointment and could not attend';
    case 'address':
      return '14 Harehills Lane\nLeeds\nLS9 6AB';
    case 'date':
      return '2026-11-03';
    case 'money':
      return '420000';
    case 'number':
      return String(f.min ?? 14);
    case 'percent':
      return '4.25';
    case 'choice':
      return f.options![0].id;
    case 'yesno':
      return 'yes';
  }
}

function fillAll(fields: Field[]) {
  const a: Answers = {};
  // Fill repeatedly so conditional fields that become active also get answers.
  for (let i = 0; i < 4; i++) for (const f of activeFields(fields, a, TODAY)) a[f.key] ??= sample(f);
  return a;
}

describe('templates', () => {
  for (const t of TEMPLATES) {
    test(`${t.id} renders complete text and a PDF`, async () => {
      const a = fillAll(t.fields);
      expect(missingFields(t.fields, a, TODAY)).toEqual([]);
      const doc = t.render(a, helpers(a, t.fields, TODAY));
      const text = toPlainText(doc);
      expect(text.length).toBeGreaterThan(300);
      expect(text).not.toMatch(/undefined|null|NaN|\[object/);
      const { bytes, pages } = await renderPdf(doc, { reference: 'D-TEST01', brand: 'Test' });
      expect(pages).toBeGreaterThanOrEqual(1);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
      expect(t.nextSteps(a).length).toBeGreaterThan(0);
    });

    test(`${t.id} handles blanks and skips`, () => {
      const a = fillAll(t.fields);
      for (const f of t.fields) {
        if (f.placeholderOk) a[f.key] = BLANK;
        else if (f.required === false) a[f.key] = SKIP;
      }
      const text = toPlainText(t.render(a, helpers(a, t.fields, TODAY)));
      expect(text).not.toContain(BLANK);
      expect(text).not.toContain(SKIP);
    });
  }
});

describe('fields', () => {
  const money: Field = { key: 'm', label: 'm', question: '', kind: 'money' };
  const date: Field = { key: 'd', label: 'd', question: '', kind: 'date' };
  const ni: Field = { key: 'n', label: 'n', question: '', kind: 'text', placeholderOk: true };
  const opt: Field = { key: 'o', label: 'o', question: '', kind: 'optional' as never, required: false };

  test('money is always pounds', () => {
    expect(normalise(money, '£4,000', TODAY)).toBe('400000');
    expect(normalise(money, '4000', TODAY)).toBe('400000');
    expect(normalise(money, '12.50', TODAY)).toBe('1250');
    expect(normalise(money, '4k', TODAY)).toBe('400000');
    expect(normalise(money, 'lots', TODAY)).toBeNull();
  });

  test('dates', () => {
    expect(normalise(date, '2026-11-03', TODAY)).toBe('2026-11-03');
    expect(normalise(date, '3/11/2026', TODAY)).toBe('2026-11-03');
    expect(normalise(date, '3 November', TODAY)).toBe('2026-11-03');
    expect(normalise(date, 'today', TODAY)).toBe(TODAY);
    expect(normalise(date, '2026-02-30', TODAY)).toBeNull();
  });

  test('leave blank and skip', () => {
    expect(fallbackParse(ni, 'leave it blank', TODAY)).toBe(BLANK);
    expect(fallbackParse(opt, 'skip', TODAY)).toBe(SKIP);
    expect(normalise({ ...ni, placeholderOk: false }, BLANK, TODAY)).toBeNull();
  });

  test('one calendar month, clamped', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-03', 1)).toBe('2026-12-03');
    expect(addMonths('2026-11-03', 13)).toBe('2027-12-03');
  });
});

describe('legal rules', () => {
  test('late payment fixed compensation bands (s.5A)', () => {
    expect(lateCompensationPence(99_999)).toBe(4_000);
    expect(lateCompensationPence(100_000)).toBe(7_000);
    expect(lateCompensationPence(999_999)).toBe(7_000);
    expect(lateCompensationPence(1_000_000)).toBe(10_000);
  });

  test('mandatory reconsideration asks why it is late after one month', () => {
    const mr = TEMPLATES.find((t) => t.id === 'mandatory_reconsideration')!;
    const keys = (decision: string) => activeFields(mr.fields, { decision_date: decision }, TODAY).map((f) => f.key);
    expect(keys('2026-11-01')).not.toContain('late_reason');
    expect(keys('2026-09-01')).toContain('late_reason');
    expect(mr.warnings!({ decision_date: '2025-01-01' }, TODAY)[0]).toMatch(/13 months/);
  });

  test('individual debtors get the pre-action protocol and 30 days', () => {
    const t = TEMPLATES.find((x) => x.id === 'invoice_demand')!;
    const a = { ...fillAll(t.fields), debtor_business: 'no' };
    const text = toPlainText(t.render(a, helpers(a, t.fields, TODAY)));
    expect(text).toMatch(/Pre-Action Protocol for Debt Claims/);
    expect(text).toMatch(/within 30 days/);
    expect(text).not.toMatch(/Late Payment of Commercial Debts/);
  });

  test('business debtors get statutory interest and compensation', () => {
    const t = TEMPLATES.find((x) => x.id === 'invoice_demand')!;
    const a: Answers = { ...fillAll(t.fields), debtor_business: 'yes', contract_interest: 'no', amount: '420000', due_date: '2026-10-01', base_rate: '4' };
    const text = toPlainText(t.render(a, helpers(a, t.fields, TODAY)));
    expect(text).toMatch(/8% a year above the Bank of England base rate/);
    expect(text).toMatch(/fixed compensation of £70/);
    expect(text).toMatch(/12\.00% a year for 43 days/);
  });
});

describe('intent', () => {
  test('spots drafting requests', () => {
    expect(looksLikeDraftRequest('Can you write me a letter to my landlord about damp?')).toBe(true);
    expect(looksLikeDraftRequest('I want a legal draft for an NDA')).toBe(true);
    expect(looksLikeDraftRequest('The date on my letter is 3 November')).toBe(false);
    expect(looksLikeDraftRequest('I have no food')).toBe(false);
  });

  test('blocks reserved and unsafe documents', () => {
    const blocked = (s: string) => OUT_OF_SCOPE.some((o) => o.match.test(s));
    expect(blocked('Can you draft my will?')).toBe(true);
    expect(blocked('write a transfer of my house to my son')).toBe(true);
    expect(blocked('draft a lease for our shop')).toBe(true);
    expect(blocked('draft an NDA')).toBe(false);
  });
});

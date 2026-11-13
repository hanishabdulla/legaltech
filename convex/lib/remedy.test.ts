import { describe, expect, test } from 'vitest';
import { flagRules, guardCitations, keywordTriage, type DraftAnswer, type Triage } from './flags';
import { addWorkingHours } from './serviceLevel';
import { tractionScore } from './traction';

const triage = (t: Partial<Triage> = {}): Triage => ({
  topic: 'employment',
  urgency: 'standard',
  outOfScope: false,
  outOfScopeReason: null,
  valueAtStakePence: null,
  deadlineMentioned: false,
  reservedActivity: null,
  sharesOrInvestment: false,
  ...t,
});
const draft = (d: Partial<DraftAnswer> = {}): DraftAnswer => ({
  answer: 'x',
  citations: [],
  needsJudgement: [],
  missingFacts: [],
  confidence: 0.9,
  nextStep: '',
  ...d,
});
const codes = (...args: Parameters<typeof flagRules>) => flagRules(...args).map((f) => f.code);

describe('flag rules', () => {
  test('a clean, confident answer has no flags', () => {
    expect(codes({ triage: triage(), draft: draft(), citationsDropped: 0, stage: 'trading', hasDocument: false })).toEqual([]);
  });
  test('each rule fires', () => {
    expect(codes({ triage: triage(), draft: draft({ needsJudgement: [{ reason: 'r', questionForLawyer: 'q' }] }), citationsDropped: 0, stage: 'trading', hasDocument: false })).toEqual(['NEEDS_JUDGEMENT']);
    expect(codes({ triage: triage(), draft: draft({ missingFacts: ['hours'] }), citationsDropped: 0, stage: 'trading', hasDocument: false })).toEqual(['MISSING_FACTS']);
    expect(codes({ triage: triage({ deadlineMentioned: true }), draft: draft(), citationsDropped: 0, stage: 'trading', hasDocument: false })).toEqual(['DEADLINE_RISK']);
    expect(codes({ triage: triage({ valueAtStakePence: 1_500_000 }), draft: draft(), citationsDropped: 0, stage: 'trading', hasDocument: false })).toEqual(['HIGH_VALUE']);
    expect(codes({ triage: triage({ sharesOrInvestment: true }), draft: draft(), citationsDropped: 0, stage: 'raising', hasDocument: false })).toEqual(['HIGH_VALUE']);
    expect(codes({ triage: triage({ sharesOrInvestment: true }), draft: draft(), citationsDropped: 0, stage: 'trading', hasDocument: false })).toEqual([]);
    expect(codes({ triage: triage({ reservedActivity: 'litigation' }), draft: draft(), citationsDropped: 0, stage: 'trading', hasDocument: false })).toEqual(['RESERVED_ACTIVITY']);
    expect(codes({ triage: triage(), draft: draft(), citationsDropped: 0, stage: 'trading', hasDocument: true })).toEqual(['DOC_REVIEW']);
    expect(codes({ triage: triage(), draft: draft({ confidence: 0.5 }), citationsDropped: 0, stage: 'trading', hasDocument: false })).toEqual(['LOW_CONFIDENCE']);
    expect(codes({ triage: triage(), draft: draft(), citationsDropped: 1, stage: 'trading', hasDocument: false })).toEqual(['LOW_CONFIDENCE']);
    expect(codes({ triage: triage({ outOfScope: true }), draft: draft(), citationsDropped: 0, stage: 'trading', hasDocument: false })).toEqual(['OUT_OF_SCOPE']);
  });
  test('no draft (AI failed twice) goes to a lawyer', () => {
    expect(codes({ triage: triage(), draft: null, citationsDropped: 0, stage: 'idea', hasDocument: false })).toEqual(['LOW_CONFIDENCE']);
  });
});

describe('citation guard', () => {
  const retrieved = [{ _id: 'a', act: 'Employment Rights Act 1996', section: '230', url: 'https://www.legislation.gov.uk/ukpga/1996/18/section/230' }];
  test('drops invented citations and rebuilds urls from the stored chunk', () => {
    const r = guardCitations([{ chunkId: 'a' }, { chunkId: 'invented' }, { chunkId: 'a' }], retrieved);
    expect(r.dropped).toBe(1);
    expect(r.citations).toEqual([{ chunkId: 'a', act: 'Employment Rights Act 1996', section: '230', url: retrieved[0].url }]);
  });
});

describe('traction score', () => {
  const base = { stage: 'trading' as const, headcount: 3, initialHeadcount: 3, documentKinds: [], matters: [], now: Date.UTC(2026, 10, 13) };
  test('raising + term sheet passes 60', () => {
    expect(tractionScore(base).score).toBe(0);
    expect(tractionScore({ ...base, stage: 'raising' }).score).toBe(40);
    expect(tractionScore({ ...base, stage: 'raising', documentKinds: ['term_sheet'] }).score).toBe(60);
  });
  test('headcount, high value and matter volume', () => {
    const day = 86_400_000;
    const r = tractionScore({
      ...base,
      headcount: 4,
      matters: [
        { createdAt: base.now - day, flagCodes: ['HIGH_VALUE'] },
        { createdAt: base.now - 2 * day, flagCodes: [] },
        { createdAt: base.now - 3 * day, flagCodes: [] },
      ],
    });
    expect(r.signals.map((s) => s.points)).toEqual([15, 15, 10]);
    expect(tractionScore({ ...base, matters: [{ createdAt: base.now - 90 * day, flagCodes: [] }] }).score).toBe(0);
  });
});

describe('service level and triage', () => {
  test('4 working hours from Friday 3pm lands Monday 11am London', () => {
    const fri3pm = Date.UTC(2026, 10, 13, 15, 0); // Friday 13 Nov 2026, GMT
    expect(new Date(addWorkingHours(fri3pm, 4)).toISOString()).toBe('2026-11-16T11:00:00.000Z');
  });
  test('keyword triage', () => {
    expect(keywordTriage('Can I take on a freelancer 3 days a week?').topic).toBe('employment');
    expect(keywordTriage('A client owes me £3,000 and I want to sue in court').reservedActivity).toBe('litigation');
  });
});

describe('citation markers', () => {
  test('renders verified ids as labels and drops unverified ones', async () => {
    const { renderCitationMarkers } = await import('./flags');
    const id1 = 'm172bm6s72e6k0hhfrxs25ygks8j5vm8';
    const id2 = 'm179eqj3a4gnd7s8ab6n3qs2rx8j4r0g';
    const out = renderCitationMarkers(`An employee works under a contract [${id1}]. Workers get holiday [${id2}], [${id1}]. Made up [zzzzzzzzzzzzzzzzzzzzzzzz].`, [
      { chunkId: id1, act: 'Employment Rights Act 1996', section: '230' },
      { chunkId: id2, act: 'GOV.UK: Employment status', section: 'Worker' },
    ]);
    expect(out).toBe('An employee works under a contract (Employment Rights Act 1996, s.230). Workers get holiday (GOV.UK Employment status: Worker; Employment Rights Act 1996, s.230). Made up.');
  });
});

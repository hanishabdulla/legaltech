/** Rules-based traction score (mvp2.md §6.5). Pure, unit tested. */

export const TRACTION_THRESHOLD = 60;
export const GROWTH_DOC_KINDS = ['term_sheet', 'shareholders_agreement'];
const DAY = 24 * 60 * 60 * 1000;

export type TractionInput = {
  stage: 'idea' | 'trading' | 'raising';
  headcount: number;
  initialHeadcount?: number;
  documentKinds: string[];
  matters: { createdAt: number; flagCodes: string[] }[];
  now: number;
};

export function tractionScore(input: TractionInput) {
  const signals: { signal: string; points: number }[] = [];
  if (input.stage === 'raising') signals.push({ signal: 'Raising investment', points: 40 });
  if (input.documentKinds.some((k) => GROWTH_DOC_KINDS.includes(k))) {
    signals.push({ signal: 'Term sheet or shareholders’ agreement uploaded', points: 20 });
  }
  if (input.headcount >= 5 || (input.initialHeadcount !== undefined && input.headcount > input.initialHeadcount)) {
    signals.push({ signal: input.headcount >= 5 ? '5 or more staff' : 'Team growing since sign-up', points: 15 });
  }
  if (input.matters.some((m) => m.flagCodes.includes('HIGH_VALUE'))) signals.push({ signal: 'A high-value matter', points: 15 });
  if (input.matters.filter((m) => m.createdAt >= input.now - 60 * DAY).length >= 3) {
    signals.push({ signal: '3 or more matters in 60 days', points: 10 });
  }
  return { score: Math.min(100, signals.reduce((s, x) => s + x.points, 0)), signals };
}

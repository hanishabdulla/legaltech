import type { Answers } from './questions';

/** Max food vouchers in a rolling six months. */
export const MAX_FOOD_VOUCHERS_6M = 3;
export const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export type PolicyResult = {
  eligible: boolean;
  urgent: boolean;
  foodValuePence: number;
  fuelValuePence: number;
  signals: string[];
  blockedReason?: string;
};

/**
 * Deterministic guardrails. The AI writes the explanation and may decide
 * eligibility, but voucher values and the frequency limit always come from here.
 */
export function applyPolicy(a: Answers, foodVouchersLast6m: number): PolicyResult {
  const signals: string[] = [];

  const meansTested = a.benefits.some((b) =>
    ['universal_credit', 'pension_credit', 'esa_jsa', 'housing_benefit', 'council_tax_reduction'].includes(b),
  );
  if (meansTested) signals.push('Receives a means-tested benefit');

  const lowIncome = ['under_300', '300_600'].includes(a.income);
  if (lowIncome) signals.push('Very low household income');

  const crisis = a.reasons.filter((r) =>
    ['benefit_delay', 'benefit_change', 'lost_job', 'unexpected_bill', 'housing', 'relationship'].includes(r),
  );
  if (crisis.length) signals.push('Has had a recent crisis');

  const noFood = ['none', 'one_two_days'].includes(a.foodAtHome);
  if (noFood) signals.push('Little or no food at home');

  const eligibleByNeed = meansTested || lowIncome || crisis.length > 0 || noFood;
  const urgent = a.foodAtHome === 'none' || a.reasons.includes('housing') || a.reasons.includes('relationship');

  const people = Math.max(1, a.adults) + a.children;
  const foodValuePence = Math.min(12000, 3000 + 1500 * (people - 1));
  const fuelValuePence = a.energy === 'cant_top_up' ? 4900 : a.energy === 'struggling' ? 2500 : 0;

  if (foodVouchersLast6m >= MAX_FOOD_VOUCHERS_6M) {
    return {
      eligible: false,
      urgent,
      foodValuePence: 0,
      fuelValuePence: 0,
      signals,
      blockedReason: `You’ve already had ${foodVouchersLast6m} food vouchers in the last six months, which is the limit.`,
    };
  }

  return {
    eligible: eligibleByNeed,
    urgent,
    foodValuePence: eligibleByNeed ? foodValuePence : 0,
    fuelValuePence: eligibleByNeed ? fuelValuePence : 0,
    signals,
  };
}

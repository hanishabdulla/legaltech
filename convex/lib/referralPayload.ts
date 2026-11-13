import type { Doc } from '../_generated/dataModel';
import { BENEFITS, DIETARY, REASONS } from './questions';
import type { SchemeId } from './schemes';

const labels = (opts: { id: string; label: string }[], ids?: string[]) =>
  (ids ?? []).map((id) => opts.find((o) => o.id === id)?.label ?? id);

/**
 * Pre-filled fields an adviser copies into the partner's form (Trussell
 * e-referral, Leeds Crisis Payment form, fuel partner). No name or NI number:
 * the adviser adds those with the client's consent.
 */
export function buildReferralPayload(scheme: SchemeId, c: Doc<'cases'>) {
  const f = c.facts;
  const base = {
    householdAdults: f.adults ?? null,
    householdChildren: f.children ?? null,
    postcodeDistrict: f.postcodeDistrict ?? null,
    reasons: labels(REASONS, f.reasons).slice(0, 4),
    incomeSources: labels(BENEFITS, f.benefits),
  };
  if (scheme === 'food_bank_referral') {
    return { ...base, dietary: labels(DIETARY, f.dietary), preferredRetailer: c.retailer ?? 'Tesco', vouchersLast6Months: f.foodVouchersLast6m ?? null };
  }
  if (scheme === 'fuel_support') {
    return { ...base, prepaymentMeter: f.hasPrepaymentMeter ?? null, meterCreditPence: f.meterCreditPence ?? null };
  }
  return {
    ...base,
    aged16Plus: f.age16Plus ?? null,
    moneyAvailablePence: f.moneyAvailablePence ?? null,
    crisisPaymentLast12Months: f.crisisPaymentLast12Months ?? null,
    supportNeeded: 'Food and fuel',
    summary: c.adviserSummary ?? '',
  };
}

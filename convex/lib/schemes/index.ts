import type { Facts } from '../facts';
import { DEMO_FOOD_VALUE, DEMO_FUEL_VALUE } from '../demoValues';

export const RULESET_VERSION = 'leeds-2026-11-13';

export type SchemeId = 'leeds_crisis_payment' | 'food_bank_referral' | 'fuel_support';
export type Outcome = 'likely' | 'unlikely' | 'needs_info';
export type TraceItem = { criterion: string; met: boolean | null; evidence: string };
export type SchemeResult = {
  scheme: SchemeId;
  outcome: Outcome;
  trace: TraceItem[];
  /** Flags for the adviser that are not a refusal. */
  flags: string[];
};

export const SCHEME_INFO: Record<SchemeId, { name: string; who: string; contact?: string; source: string }> = {
  leeds_crisis_payment: {
    name: 'Leeds Crisis Payment',
    who: 'Leeds City Council decides',
    contact: '0800 953 2303',
    source: 'leeds.gov.uk/benefits/crisis-payment-scheme (checked 13 Nov 2026)',
  },
  food_bank_referral: {
    name: 'Food bank referral',
    who: 'A referral agency sends it to the food bank',
    contact: 'Leeds Citizens Advice 0808 278 7878',
    source: 'Trussell e-referral process; Leeds South & East referral agencies',
  },
  fuel_support: {
    name: 'Fuel top-up support',
    who: 'An adviser refers you to a fuel voucher partner',
    source: 'Mock fuel voucher partner (pilot: Fuel Bank Foundation or local energy advice)',
  },
};

const pounds = (p: number) => `£${(p / 100).toFixed(p % 100 ? 2 : 0)}`;

const QUALIFYING = ['universal_credit', 'housing_benefit', 'council_tax_reduction', 'pension_credit', 'esa_jsa'];
const CRISIS_REASONS = ['benefit_delay', 'benefit_change', 'lost_job', 'unexpected_bill', 'sickness', 'housing', 'relationship'];

function outcomeOf(trace: TraceItem[]): Outcome {
  if (trace.some((t) => t.met === false)) return 'unlikely';
  if (trace.some((t) => t.met === null)) return 'needs_info';
  return 'likely';
}

/** Leeds Crisis Payment Scheme (replaced Local Welfare Support from 1 April 2026). */
export function leedsCrisisPayment(f: Facts): SchemeResult {
  const trace: TraceItem[] = [];

  trace.push({
    criterion: 'Lives in Leeds',
    met: f.leedsResident ?? null,
    evidence: f.postcodeDistrict ? `Postcode district ${f.postcodeDistrict}` : f.leedsResident === undefined ? 'Not known yet' : 'Told us',
  });
  trace.push({
    criterion: 'Aged 16 or over',
    met: f.age16Plus ?? null,
    evidence: f.age16Plus === undefined ? 'Not known yet' : 'Told us',
  });

  const benefits = f.benefits ?? [];
  const qualifying = benefits.filter((b) => QUALIFYING.includes(b));
  trace.push({
    criterion: 'Gets or has applied for a qualifying benefit (e.g. Universal Credit, Housing Benefit, Council Tax Support)',
    met: f.benefits === undefined ? null : qualifying.length > 0,
    evidence: f.benefits === undefined ? 'Not known yet' : qualifying.length ? `Has ${qualifying.length} qualifying benefit(s)` : 'No qualifying benefit',
  });

  const crisis = (f.reasons ?? []).filter((r) => CRISIS_REASONS.includes(r));
  trace.push({
    criterion: 'Has had a crisis (e.g. sudden loss of income, essential bill over £100, threat of violence)',
    met: f.reasons === undefined ? null : crisis.length > 0 || !!f.movingFromSupportedAccommodation,
    evidence: f.reasons === undefined ? 'Not known yet' : crisis.length ? 'Crisis described' : 'No qualifying crisis described',
  });

  trace.push({
    criterion: 'Has less than £150 available (for food or fuel help)',
    met: f.moneyAvailablePence === undefined ? null : f.moneyAvailablePence < 15000,
    evidence: f.moneyAvailablePence === undefined ? 'Not known yet' : `${pounds(f.moneyAvailablePence)} available`,
  });

  const exempt = !!f.movingFromSupportedAccommodation;
  trace.push({
    criterion: 'No Crisis Payment in the last 12 months',
    met: f.crisisPaymentLast12Months === undefined ? null : !f.crisisPaymentLast12Months || exempt,
    evidence:
      f.crisisPaymentLast12Months === undefined
        ? 'Not known yet'
        : f.crisisPaymentLast12Months
          ? exempt
            ? 'Had one, but moving from supported accommodation is an exception'
            : 'Had one in the last 12 months'
          : 'None in the last 12 months',
  });

  return { scheme: 'leeds_crisis_payment', outcome: outcomeOf(trace), trace, flags: [] };
}

/** Food bank referral (Trussell e-referral). The 3-in-6-months rule is a flag, not a ban. */
export function foodBankReferral(f: Facts): SchemeResult {
  const trace: TraceItem[] = [];
  const lowFood = f.foodAtHome === undefined ? null : ['none', 'one_two_days', 'under_week'].includes(f.foodAtHome);
  const lowMoney = f.moneyAvailablePence === undefined ? null : f.moneyAvailablePence < 5000;
  const inNeed = lowFood === true || lowMoney === true ? true : lowFood === null && lowMoney === null ? null : false;

  trace.push({
    criterion: 'Can’t afford enough food right now',
    met: inNeed,
    evidence: [
      f.foodAtHome !== undefined ? `Food at home: ${f.foodAtHome.replace(/_/g, ' ')}` : null,
      f.moneyAvailablePence !== undefined ? `${pounds(f.moneyAvailablePence)} to live on` : null,
    ]
      .filter(Boolean)
      .join('; ') || 'Not known yet',
  });
  trace.push({
    criterion: 'Referred by a referral agency',
    met: true,
    evidence: 'An adviser checks and approves this referral',
  });

  const flags: string[] = [];
  if ((f.foodVouchersLast6m ?? 0) >= 3) {
    flags.push(`Has had ${f.foodVouchersLast6m} food vouchers in 6 months: record a reason and contact the food bank before referring.`);
  }
  return { scheme: 'food_bank_referral', outcome: outcomeOf(trace), trace, flags };
}

/** Fuel support for prepayment customers who can't top up. */
export function fuelSupport(f: Facts): SchemeResult {
  const trace: TraceItem[] = [];
  const prepay = f.hasPrepaymentMeter ?? (f.energy === 'cant_top_up' ? true : f.energy === 'ok' ? false : undefined);
  trace.push({
    criterion: 'Has a prepayment meter',
    met: prepay ?? null,
    evidence: prepay === undefined ? 'Not known yet' : prepay ? 'Prepayment meter' : 'No prepayment meter',
  });
  const cantTopUp =
    f.energy === 'cant_top_up' || (f.meterCreditPence !== undefined && f.meterCreditPence < 500)
      ? true
      : f.energy === undefined && f.meterCreditPence === undefined
        ? null
        : false;
  trace.push({
    criterion: 'Can’t afford to top up',
    met: cantTopUp,
    evidence:
      f.meterCreditPence !== undefined
        ? f.meterCreditPence <= 0
          ? 'Meter on emergency credit'
          : `${pounds(f.meterCreditPence)} credit left`
        : f.energy
          ? f.energy.replace(/_/g, ' ')
          : 'Not known yet',
  });
  return { scheme: 'fuel_support', outcome: outcomeOf(trace), trace, flags: [] };
}

export function runAllSchemes(f: Facts): SchemeResult[] {
  return [leedsCrisisPayment(f), foodBankReferral(f), fuelSupport(f)];
}

/** Illustrative demo values for the vouchers an approved referral produces. */
export function demoVoucherValue(scheme: SchemeId, f: Facts) {
  if (scheme === 'food_bank_referral') return DEMO_FOOD_VALUE(f);
  if (scheme === 'fuel_support') return DEMO_FUEL_VALUE;
  return 0;
}

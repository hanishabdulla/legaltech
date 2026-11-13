import { v, type Infer } from 'convex/values';
import { BENEFITS, COOKING, DIETARY, ENERGY, FOOD_AT_HOME, REASONS, type Option } from './questions';

/**
 * Everything we know about a person's situation. Every field is optional:
 * the intake fills them in progressively, from what the client says, from
 * documents, or from an adviser.
 */
export const factsValidator = v.object({
  adults: v.optional(v.number()),
  children: v.optional(v.number()),
  age16Plus: v.optional(v.boolean()),
  postcodeDistrict: v.optional(v.string()),
  leedsResident: v.optional(v.boolean()),
  reasons: v.optional(v.array(v.string())),
  benefits: v.optional(v.array(v.string())),
  moneyAvailablePence: v.optional(v.number()),
  foodAtHome: v.optional(v.string()),
  cooking: v.optional(v.string()),
  dietary: v.optional(v.array(v.string())),
  energy: v.optional(v.string()),
  hasPrepaymentMeter: v.optional(v.boolean()),
  meterCreditPence: v.optional(v.number()),
  crisisPaymentLast12Months: v.optional(v.boolean()),
  movingFromSupportedAccommodation: v.optional(v.boolean()),
  benefitDecisionDate: v.optional(v.string()), // YYYY-MM-DD, date on the DWP letter
  benefitDecisionType: v.optional(v.string()), // 'sanction' | 'refusal' | 'reduction' | 'other'
  debtTypes: v.optional(v.array(v.string())),
  foodVouchersLast6m: v.optional(v.number()),
});
export type Facts = Infer<typeof factsValidator>;
export type FactKey = keyof Facts;

export const FACT_KEYS = Object.keys(factsValidator.fields) as FactKey[];

export type FactSource = 'client' | 'document' | 'adviser';

const ARRAY_OPTIONS: Partial<Record<FactKey, Option[]>> = {
  reasons: REASONS,
  benefits: BENEFITS,
  dietary: DIETARY,
};
const SINGLE_OPTIONS: Partial<Record<FactKey, Option[]>> = {
  foodAtHome: FOOD_AT_HOME,
  cooking: COOKING,
  energy: ENERGY,
};

/** Allowed ids per option field, for validating AI output. */
export const ALLOWED_IDS: Partial<Record<FactKey, string[]>> = Object.fromEntries(
  [...Object.entries(ARRAY_OPTIONS), ...Object.entries(SINGLE_OPTIONS)].map(([k, opts]) => [k, opts!.map((o) => o.id)]),
);

export const DEBT_TYPES = ['rent', 'council_tax', 'energy', 'water', 'credit_card_or_loan', 'benefit_overpayment', 'other'];
export const DECISION_TYPES = ['sanction', 'refusal', 'reduction', 'other'];

/** Leeds is covered by postcode districts LS1 to LS29 (a few edges are not, which the adviser checks). */
export function isLeedsDistrict(district: string) {
  const m = /^LS(\d{1,2})$/.exec(district.toUpperCase());
  return !!m && Number(m[1]) >= 1 && Number(m[1]) <= 29;
}

/** Cleans untrusted input (from the AI or a form) into valid facts. Unknown or malformed values are dropped. */
export function sanitiseFacts(raw: Record<string, unknown>): Facts {
  const out: Facts = {};
  const num = (x: unknown, min: number, max: number) =>
    typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? Math.round(x) : undefined;
  const bool = (x: unknown) => (typeof x === 'boolean' ? x : undefined);
  const ids = (key: FactKey, x: unknown) => {
    if (!Array.isArray(x)) return undefined;
    const allowed = ALLOWED_IDS[key] ?? DEBT_TYPES;
    const list = [...new Set(x.filter((i): i is string => typeof i === 'string' && allowed.includes(i)))];
    return list.length ? list : undefined;
  };
  const one = (key: FactKey, x: unknown) =>
    typeof x === 'string' && (ALLOWED_IDS[key] ?? []).includes(x) ? x : undefined;

  const set = <K extends FactKey>(k: K, val: Facts[K] | undefined) => {
    if (val !== undefined) out[k] = val;
  };

  set('adults', num(raw.adults, 1, 15));
  set('children', num(raw.children, 0, 15));
  set('age16Plus', bool(raw.age16Plus));
  if (typeof raw.postcodeDistrict === 'string') {
    const d = raw.postcodeDistrict.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (/^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(d)) set('postcodeDistrict', d);
  }
  set('leedsResident', bool(raw.leedsResident));
  set('reasons', ids('reasons', raw.reasons));
  set('benefits', ids('benefits', raw.benefits));
  set('moneyAvailablePence', num(raw.moneyAvailablePence, 0, 10_000_000));
  set('foodAtHome', one('foodAtHome', raw.foodAtHome));
  set('cooking', one('cooking', raw.cooking));
  set('dietary', ids('dietary', raw.dietary));
  set('energy', one('energy', raw.energy));
  set('hasPrepaymentMeter', bool(raw.hasPrepaymentMeter));
  set('meterCreditPence', num(raw.meterCreditPence, -100_000, 1_000_000));
  set('crisisPaymentLast12Months', bool(raw.crisisPaymentLast12Months));
  set('movingFromSupportedAccommodation', bool(raw.movingFromSupportedAccommodation));
  if (typeof raw.benefitDecisionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.benefitDecisionDate)) {
    set('benefitDecisionDate', raw.benefitDecisionDate);
  }
  if (typeof raw.benefitDecisionType === 'string' && DECISION_TYPES.includes(raw.benefitDecisionType)) {
    set('benefitDecisionType', raw.benefitDecisionType);
  }
  set('debtTypes', ids('debtTypes', raw.debtTypes));
  set('foodVouchersLast6m', num(raw.foodVouchersLast6m, 0, 50));

  // Derived: a Leeds postcode district answers the residency question.
  if (out.postcodeDistrict && out.leedsResident === undefined && isLeedsDistrict(out.postcodeDistrict)) {
    out.leedsResident = true;
  }
  // Derived: Universal Credit and Pension Credit claimants are over 16.
  if (out.age16Plus === undefined && out.benefits?.some((b) => b === 'universal_credit' || b === 'pension_credit')) {
    out.age16Plus = true;
  }
  return out;
}

/**
 * The questions the rules need answered, in the order we ask them.
 * `when` skips a question that doesn't apply.
 */
export const NEEDED: {
  key: FactKey;
  question: string;
  suggestions: string[];
  when?: (f: Facts) => boolean;
}[] = [
  { key: 'reasons', question: 'What’s happened that means you need help right now?', suggestions: ['My benefits were sanctioned', 'My Universal Credit is late', 'I lost my job', 'A big unexpected bill'] },
  { key: 'adults', question: 'How many adults live with you, including you?', suggestions: ['Just me', '2 adults', '3 or more'] },
  { key: 'children', question: 'And how many children under 16?', suggestions: ['None', '1 child', '2 children', '3 or more'] },
  { key: 'postcodeDistrict', question: 'What’s the first part of your postcode?', suggestions: ['LS9', 'LS7', 'LS11', 'I’m not in Leeds'] },
  { key: 'age16Plus', question: 'Are you aged 16 or over?', suggestions: ['Yes', 'No'] },
  { key: 'benefits', question: 'Do you get, or have you applied for, any benefits?', suggestions: ['Universal Credit', 'Housing Benefit', 'Council Tax Support', 'None'] },
  { key: 'moneyAvailablePence', question: 'Roughly how much money do you have to last until your next payment?', suggestions: ['Nothing', 'Under £20', 'About £50', 'Over £150'] },
  { key: 'foodAtHome', question: 'How much food do you have at home?', suggestions: ['None', 'A day or two', 'A few days', 'A week or more'] },
  { key: 'energy', question: 'How are you doing with gas and electric?', suggestions: ['I can’t top up my meter', 'Struggling with bills', 'It’s OK for now'] },
  { key: 'meterCreditPence', question: 'How much credit is left on your meter?', suggestions: ['On emergency credit', 'Under £5', 'About £10'], when: (f) => f.hasPrepaymentMeter === true || f.energy === 'cant_top_up' },
  { key: 'benefitDecisionDate', question: 'What date is on the letter about your benefits decision?', suggestions: ['Last week', 'About 2 weeks ago', 'I don’t know'], when: (f) => !!f.reasons?.includes('benefit_change') },
  { key: 'crisisPaymentLast12Months', question: 'Have you had a Leeds Crisis Payment in the last 12 months?', suggestions: ['No', 'Yes', 'Not sure'], when: (f) => f.leedsResident !== false },
  { key: 'dietary', question: 'Any food needs, like halal, vegetarian or baby formula?', suggestions: ['None', 'Halal', 'Vegetarian', 'Baby formula or nappies'] },
];

export function missingFacts(f: Facts) {
  return NEEDED.filter((n) => (n.when ? n.when(f) : true) && f[n.key] === undefined);
}

const optLabel = (opts: Option[] | undefined, id: string) => opts?.find((o) => o.id === id)?.label ?? id;
const pounds = (p: number) => (p % 100 === 0 ? `£${p / 100}` : `£${(p / 100).toFixed(2)}`);

/** Short human labels for "We understood" chips and adviser views. */
export function factChips(f: Facts): { key: FactKey; label: string }[] {
  const chips: { key: FactKey; label: string }[] = [];
  const add = (key: FactKey, label: string | undefined) => label && chips.push({ key, label });

  if (f.adults !== undefined || f.children !== undefined) {
    const a = f.adults ?? 1;
    const parts = [`${a} adult${a === 1 ? '' : 's'}`];
    if (f.children !== undefined) parts.push(f.children === 0 ? 'no children' : `${f.children} child${f.children === 1 ? '' : 'ren'}`);
    add(f.adults !== undefined ? 'adults' : 'children', parts.join(', '));
  }
  if (f.postcodeDistrict) add('postcodeDistrict', `${f.postcodeDistrict}${f.leedsResident ? ', Leeds' : ''}`);
  else if (f.leedsResident !== undefined) add('leedsResident', f.leedsResident ? 'Lives in Leeds' : 'Outside Leeds');
  if (f.age16Plus !== undefined) add('age16Plus', f.age16Plus ? 'Aged 16+' : 'Under 16');
  f.reasons?.forEach((r) => add('reasons', optLabel(REASONS, r)));
  if (f.benefits) add('benefits', f.benefits.includes('none') ? 'No benefits' : f.benefits.map((b) => optLabel(BENEFITS, b)).join(', '));
  if (f.moneyAvailablePence !== undefined) add('moneyAvailablePence', `${pounds(f.moneyAvailablePence)} to live on`);
  if (f.foodAtHome) add('foodAtHome', `Food: ${optLabel(FOOD_AT_HOME, f.foodAtHome).toLowerCase()}`);
  if (f.energy) add('energy', optLabel(ENERGY, f.energy));
  if (f.hasPrepaymentMeter) add('hasPrepaymentMeter', 'Prepayment meter');
  if (f.meterCreditPence !== undefined) add('meterCreditPence', f.meterCreditPence <= 0 ? 'Meter on emergency credit' : `${pounds(f.meterCreditPence)} meter credit`);
  if (f.benefitDecisionDate) add('benefitDecisionDate', `Decision letter dated ${new Date(f.benefitDecisionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`);
  if (f.crisisPaymentLast12Months !== undefined) add('crisisPaymentLast12Months', f.crisisPaymentLast12Months ? 'Had a Crisis Payment this year' : 'No Crisis Payment this year');
  if (f.dietary) add('dietary', f.dietary.includes('none') ? 'No special food needs' : f.dietary.map((d) => optLabel(DIETARY, d)).join(', '));
  if (f.cooking) add('cooking', `Cooking: ${optLabel(COOKING, f.cooking).toLowerCase()}`);
  if (f.debtTypes?.length) add('debtTypes', `Debts: ${f.debtTypes.join(', ').replace(/_/g, ' ')}`);
  return chips;
}

/** Plain-English facts for prompts and case notes. Never includes names or identifiers. */
export function describeFacts(f: Facts) {
  const chips = factChips(f).map((c) => `- ${c.label}`);
  return chips.length ? chips.join('\n') : '- (nothing yet)';
}

/** Prompt description of the fact schema, for extraction. */
export const FACT_SCHEMA_PROMPT = `{
 "adults": integer >= 1 (adults in household incl. the person),
 "children": integer >= 0 (under 16),
 "age16Plus": boolean,
 "postcodeDistrict": string like "LS9" (first half of postcode only),
 "leedsResident": boolean,
 "reasons": subset of ${JSON.stringify(REASONS.map((o) => o.id))},
 "benefits": subset of ${JSON.stringify(BENEFITS.map((o) => o.id))} (include benefits they have applied for),
 "moneyAvailablePence": integer, money they have to live on until next payment, in pence,
 "foodAtHome": one of ${JSON.stringify(FOOD_AT_HOME.map((o) => o.id))},
 "cooking": one of ${JSON.stringify(COOKING.map((o) => o.id))},
 "dietary": subset of ${JSON.stringify(DIETARY.map((o) => o.id))},
 "energy": one of ${JSON.stringify(ENERGY.map((o) => o.id))},
 "hasPrepaymentMeter": boolean,
 "meterCreditPence": integer (0 or negative if on emergency credit),
 "crisisPaymentLast12Months": boolean,
 "movingFromSupportedAccommodation": boolean,
 "benefitDecisionDate": "YYYY-MM-DD" date on the DWP decision letter,
 "benefitDecisionType": one of ${JSON.stringify(DECISION_TYPES)},
 "debtTypes": subset of ${JSON.stringify(DEBT_TYPES)},
 "foodVouchersLast6m": integer
}`;

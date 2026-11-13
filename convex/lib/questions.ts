/**
 * Option lists shared by the app (step-by-step form, chips) and the backend
 * (fact validation, prompts). Modelled on what food bank referral forms and
 * the Leeds Crisis Payment form ask for.
 */

export type Option = { id: string; label: string; hint?: string };

export const REASONS: Option[] = [
  { id: 'benefit_delay', label: 'Waiting for a benefit payment' },
  { id: 'benefit_change', label: 'My benefits were cut, changed or sanctioned' },
  { id: 'low_income', label: 'My income doesn’t cover the basics' },
  { id: 'debt', label: 'Debt or arrears' },
  { id: 'lost_job', label: 'I lost my job or my hours were cut' },
  { id: 'unexpected_bill', label: 'A big unexpected cost' },
  { id: 'sickness', label: 'Illness or disability' },
  { id: 'housing', label: 'Housing problems or homelessness' },
  { id: 'relationship', label: 'Relationship breakdown or domestic abuse' },
  { id: 'other', label: 'Something else' },
];

export const BENEFITS: Option[] = [
  { id: 'universal_credit', label: 'Universal Credit' },
  { id: 'pension_credit', label: 'Pension Credit' },
  { id: 'esa_jsa', label: 'Income-based ESA or JSA' },
  { id: 'housing_benefit', label: 'Housing Benefit' },
  { id: 'pip', label: 'PIP or Disability Living Allowance' },
  { id: 'child_benefit', label: 'Child Benefit' },
  { id: 'council_tax_reduction', label: 'Council Tax Support' },
  { id: 'none', label: 'None of these' },
];

export const INCOME: Option[] = [
  { id: 'under_300', label: 'Less than £300 a month' },
  { id: '300_600', label: '£300 to £600 a month' },
  { id: '600_1000', label: '£600 to £1,000 a month' },
  { id: 'over_1000', label: 'More than £1,000 a month' },
  { id: 'unsure', label: 'I’m not sure' },
];

export const FOOD_AT_HOME: Option[] = [
  { id: 'none', label: 'Nothing, or almost nothing', hint: 'We’ll treat this as urgent' },
  { id: 'one_two_days', label: 'Enough for a day or two' },
  { id: 'under_week', label: 'Enough for a few days' },
  { id: 'week_plus', label: 'Enough for a week or more' },
];

export const COOKING: Option[] = [
  { id: 'full', label: 'A cooker or oven' },
  { id: 'microwave', label: 'Microwave only' },
  { id: 'kettle', label: 'Kettle only' },
  { id: 'none', label: 'No way to cook' },
];

export const DIETARY: Option[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'halal', label: 'Halal' },
  { id: 'kosher', label: 'Kosher' },
  { id: 'gluten_free', label: 'Gluten free' },
  { id: 'diabetic', label: 'Diabetic' },
  { id: 'baby', label: 'Baby formula or nappies' },
  { id: 'none', label: 'No special needs' },
];

export const ENERGY: Option[] = [
  { id: 'cant_top_up', label: 'I can’t top up my prepayment meter' },
  { id: 'struggling', label: 'I’m struggling to pay my energy bills' },
  { id: 'ok', label: 'My energy is OK for now' },
];

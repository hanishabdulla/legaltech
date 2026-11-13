import type { Facts } from './facts';

/**
 * Root-cause action plan. The AI classifies issues; everything here is
 * deterministic. Deadlines are only computed where the rule is clear and
 * sourced; everything else is a handoff.
 */

export const ISSUE_TYPES = [
  'benefit_sanction_or_decision',
  'benefit_delay',
  'problem_debt',
  'rent_arrears_or_eviction',
  'unpaid_wages',
  'energy_debt',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export type PlannedAction = {
  type: string;
  title: string;
  detail: string;
  deadline?: number;
  deadlineBasis?: string;
  draftLetter?: string;
  handoffTo?: string;
  handoffContact?: string;
};

/** One calendar month after the decision date (clamped to the month's last day). */
export function mandatoryReconsiderationDeadline(decisionDate: string) {
  const [y, m, d] = decisionDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d, lastDay), 23, 59);
}

function mrLetter(f: Facts) {
  const date = f.benefitDecisionDate
    ? new Date(f.benefitDecisionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '[date on your decision letter]';
  const what = f.benefitDecisionType === 'sanction' ? 'to apply a sanction to my Universal Credit' : 'about my Universal Credit';
  return `Dear Sir or Madam,

Request for mandatory reconsideration

I am asking for a mandatory reconsideration of the decision dated ${date} ${what}.

I do not agree with this decision because:
[In your own words, explain why the decision is wrong. For example: you had a good reason for missing an appointment, or you did not get the letter.]

Please send me a written explanation of the decision (a statement of reasons) if you have not already done so.

I can provide further evidence if needed. Please contact me using the details on my account.

Yours faithfully,
[Your name]
[Your National Insurance number]`;
}

export function buildActionPlan(issues: IssueType[], f: Facts): PlannedAction[] {
  const out: PlannedAction[] = [];
  const has = (i: IssueType) => issues.includes(i);

  if (has('benefit_sanction_or_decision')) {
    const deadline = f.benefitDecisionDate ? mandatoryReconsiderationDeadline(f.benefitDecisionDate) : undefined;
    out.push({
      type: 'mandatory_reconsideration',
      title: 'Challenge the benefits decision',
      detail:
        'Ask the DWP to look at the decision again (a “mandatory reconsideration”). You can do this in your Universal Credit journal or by letter. Keep paying attention to your claim while you wait.',
      deadline,
      deadlineBasis: deadline
        ? 'Within one calendar month of the date on the decision letter (DWP mandatory reconsideration time limit).'
        : 'Within one month of the date on the decision letter. Find the date on your letter to see your deadline.',
      draftLetter: mrLetter(f),
      handoffTo: 'Leeds Welfare Rights or Citizens Advice',
      handoffContact: '0808 278 7878',
    });
  }
  if (has('benefit_delay')) {
    out.push({
      type: 'uc_advance',
      title: 'Ask for an advance payment',
      detail: 'If your Universal Credit is late, you can ask for an advance through your journal or by calling the helpline. It is paid back from later payments.',
      handoffTo: 'Universal Credit helpline',
      handoffContact: '0800 328 5644',
    });
  }
  if (has('problem_debt')) {
    out.push({
      type: 'breathing_space',
      title: 'Get breathing space from debts',
      detail:
        'A debt adviser can apply for Breathing Space: 60 days when most creditors must stop contacting you, adding interest or taking action. Only a debt adviser can apply.',
      deadlineBasis: 'Debt Respite Scheme (Breathing Space): 60 days of protection once a debt adviser starts it.',
      handoffTo: 'Leeds Citizens Advice (free debt advice)',
      handoffContact: '0808 278 7878',
    });
  }
  if (has('rent_arrears_or_eviction')) {
    out.push({
      type: 'housing_advice',
      title: 'Get advice about your home',
      detail: 'If you are behind on rent or have had a notice, get advice quickly. Don’t leave your home before speaking to an adviser.',
      handoffTo: 'Shelter helpline',
      handoffContact: '0808 800 4444',
    });
  }
  if (has('unpaid_wages')) {
    out.push({
      type: 'unpaid_wages',
      title: 'Get help with unpaid wages',
      detail: 'Acas gives free, confidential advice on getting money your employer owes you. Time limits can be short, so contact them soon.',
      handoffTo: 'Acas helpline',
      handoffContact: '0300 123 1100',
    });
  }
  if (has('energy_debt')) {
    out.push({
      type: 'energy_debt',
      title: 'Ask your energy supplier for help',
      detail: 'Suppliers must offer help if you are struggling, such as affordable repayment plans or emergency credit. Ask about their hardship fund.',
      handoffTo: 'Your energy supplier',
    });
  }
  return out;
}

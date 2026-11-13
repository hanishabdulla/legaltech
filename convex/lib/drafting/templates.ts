import type { Facts } from '../facts';
import { BLANK, SKIP, addMonths, daysBetween, formatDate, formatPence, isDone, type Answers, type Field } from './fields';
import type { Block, DocModel } from './model';

/**
 * The drafting catalogue. Every legal paragraph here is fixed text: the AI
 * only collects answers and tidies the person's own words. For the pilot,
 * every template is reviewed by the partner law firm before use.
 * Law: England and Wales.
 */

export type Product = 'cc' | 'remedy';

export type PrefillContext = { facts?: Facts; business?: { name: string; companyNumber?: string } };

export type Template = {
  id: string;
  product: Product;
  title: string;
  /** One line for pickers. */
  short: string;
  /** For the AI classifier. */
  description: string;
  keywords: RegExp;
  kind: 'letter' | 'agreement';
  fields: Field[];
  prefill?: (ctx: PrefillContext) => Answers;
  warnings?: (a: Answers, today: string) => string[];
  render: (a: Answers, h: Helpers) => DocModel;
  nextSteps: (a: Answers) => string[];
};

export type Helpers = ReturnType<typeof helpers>;

const LINE = '____________________';

export function helpers(a: Answers, fields: Field[], today: string) {
  const has = (k: string) => isDone(a[k]) && a[k] !== BLANK && a[k] !== SKIP;
  const v = (k: string, fallback = `[${LINE}]`) => (a[k] === BLANK ? LINE : has(k) ? a[k] : fallback);
  const lines = (k: string) => (has(k) ? a[k].split('\n') : [a[k] === BLANK || !has(k) ? `[address: ${LINE}]` : '']);
  const date = (k: string) => (has(k) ? formatDate(a[k]) : '____ / ____ / ______');
  const money = (k: string) => (has(k) ? formatPence(Number(a[k])) : `£${LINE}`);
  const opt = (k: string) => fields.find((f) => f.key === k)?.options?.find((o) => o.id === a[k])?.label ?? v(k);
  return { has, v, lines, date, money, opt, today: formatDate(today), todayIso: today };
}

const NAME: Field = { key: 'your_name', label: 'Your full name', question: 'What’s your full name, as it should appear on the letter?', kind: 'name', placeholderOk: true };
const ADDRESS: Field = {
  key: 'your_address',
  label: 'Your address',
  question: 'What’s your address, including postcode? (It goes at the top of the letter so they can reply.)',
  kind: 'address',
  placeholderOk: true,
};

const signOff = (h: Helpers, formal: boolean) => ({
  closing: formal ? 'Yours faithfully,' : 'Yours sincerely,',
  signatures: [{ label: '', lines: ['', '', h.v('your_name', LINE)] }],
});

/** A paragraph, with a full stop added if the person's words didn't end with one. */
const para = (text: string): Block => ({ t: 'p', text: /[.!?:;)"’”]$/.test(text.trim()) ? text.trim() : `${text.trim()}.` });

// ---------------------------------------------------------------------------
// Common Counsel: letters for people
// ---------------------------------------------------------------------------

const mandatoryReconsideration: Template = {
  id: 'mandatory_reconsideration',
  product: 'cc',
  title: 'Mandatory reconsideration request',
  short: 'Challenge a benefits decision (sanction, refusal or cut)',
  description: 'Letter asking the DWP to look again at a benefits decision such as a Universal Credit sanction, a PIP refusal or a reduced payment.',
  keywords: /reconsideration|sanction|appeal.*(benefit|dwp|pip|universal credit)|challenge.*(decision|dwp|benefit)/i,
  kind: 'letter',
  fields: [
    {
      key: 'benefit',
      label: 'Benefit',
      question: 'Which benefit is the decision about?',
      kind: 'choice',
      options: [
        { id: 'universal_credit', label: 'Universal Credit' },
        { id: 'pip', label: 'Personal Independence Payment (PIP)' },
        { id: 'esa', label: 'Employment and Support Allowance (ESA)' },
        { id: 'other', label: 'Another benefit' },
      ],
    },
    { key: 'benefit_other', label: 'Which benefit', question: 'Which benefit is it?', kind: 'text', when: (a) => a.benefit === 'other' },
    {
      key: 'decision',
      label: 'What they decided',
      question: 'What did the decision do?',
      kind: 'choice',
      options: [
        { id: 'sanction', label: 'Gave me a sanction' },
        { id: 'refusal', label: 'Refused my claim' },
        { id: 'reduction', label: 'Reduced my payment' },
        { id: 'overpayment', label: 'Said I was overpaid' },
        { id: 'other', label: 'Something else' },
      ],
    },
    { key: 'decision_date', label: 'Date of the decision', question: 'What date is on the decision letter or journal message?', kind: 'date', hint: 'For example 6 November 2026.' },
    {
      key: 'reasons',
      label: 'Why you disagree',
      question: 'In your own words, why is the decision wrong? For example, you had a good reason for missing an appointment, or they got your health wrong.',
      kind: 'longtext',
      tidy: true,
    },
    {
      key: 'late_reason',
      label: 'Why it’s late',
      question: 'This is more than a month after the decision, so the letter needs to say why it’s late. What stopped you asking sooner?',
      kind: 'longtext',
      tidy: true,
      when: (a, today) => isDone(a.decision_date) && today > addMonths(a.decision_date, 1),
    },
    {
      key: 'evidence',
      label: 'Evidence',
      question: 'What evidence can you send with it, if any? For example a doctor’s letter or a screenshot of a missed text.',
      kind: 'longtext',
      required: false,
    },
    NAME,
    ADDRESS,
    { key: 'ni_number', label: 'National Insurance number', question: 'What’s your National Insurance number? You can leave it blank and write it on by hand.', kind: 'text', placeholderOk: true },
  ],
  prefill: ({ facts }) => {
    const out: Answers = {};
    if (facts?.benefitDecisionDate) out.decision_date = facts.benefitDecisionDate;
    if (facts?.benefits?.includes('universal_credit')) out.benefit = 'universal_credit';
    if (facts?.benefitDecisionType === 'sanction') out.decision = 'sanction';
    else if (facts?.benefitDecisionType === 'refusal') out.decision = 'refusal';
    else if (facts?.benefitDecisionType === 'reduction') out.decision = 'reduction';
    return out;
  },
  warnings: (a, today) => {
    if (!isDone(a.decision_date)) return [];
    if (today > addMonths(a.decision_date, 13)) {
      return ['This decision is more than 13 months old, so a reconsideration may no longer be possible. Talk to Citizens Advice (0808 278 7878) before sending.'];
    }
    if (today > addMonths(a.decision_date, 1)) {
      return ['The usual deadline is one month from the decision. You can still ask up to 13 months later if you explain why it’s late, which this letter does.'];
    }
    const left = daysBetween(today, addMonths(a.decision_date, 1));
    return [`Send this by ${formatDate(addMonths(a.decision_date, 1))} (${left} day${left === 1 ? '' : 's'} left), one month from the decision.`];
  },
  render: (a, h) => {
    const benefit = a.benefit === 'other' ? h.v('benefit_other') : h.opt('benefit').replace(/ \(.*\)$/, '');
    const what: Record<string, string> = {
      sanction: 'applied a sanction to my payments',
      refusal: 'refused my claim',
      reduction: 'reduced my payment',
      overpayment: 'decided that I have been overpaid',
      other: 'affects my entitlement',
    };
    const blocks: Block[] = [
      para(`I am asking for a mandatory reconsideration of the decision dated ${h.date('decision_date')} about my ${benefit}. The decision ${what[a.decision] ?? what.other}.`),
      para('I do not agree with this decision because:'),
      para(h.v('reasons')),
    ];
    if (h.has('late_reason')) {
      blocks.push(para(`I know this request is more than one month after the date of the decision. ${h.v('late_reason')} I ask you to accept my request late.`));
    }
    blocks.push(
      para(h.has('evidence') ? `I am sending the following evidence with this letter: ${h.v('evidence')}` : 'I will send any further evidence I have as soon as I can.'),
      para('Please send me a written statement of the reasons for the decision if you have not already done so, and tell me in writing the outcome of this reconsideration.'),
      para('Please contact me if you need any more information.'),
    );
    return {
      title: 'Mandatory reconsideration request',
      kind: 'letter',
      sender: [h.v('your_name', LINE), ...h.lines('your_address')],
      recipient: ['Department for Work and Pensions', '[Address on your decision letter, or send through your online journal]'],
      date: h.today,
      refs: [`National Insurance number: ${h.v('ni_number', LINE)}`],
      subject: `Request for mandatory reconsideration: ${benefit}`,
      salutation: 'Dear Sir or Madam,',
      blocks,
      ...signOff(h, true),
    };
  },
  nextSteps: (a) => [
    a.benefit === 'universal_credit'
      ? 'Copy the text into your Universal Credit online journal, or post the letter to the address on your decision letter.'
      : 'Post it to the address on your decision letter, or phone the number on the letter and ask to make a reconsideration request.',
    'Keep a copy, and proof of when you sent it (a screenshot or a free certificate of posting from the Post Office).',
    'You must have a mandatory reconsideration before you can appeal to a tribunal.',
    'Free help: Leeds Citizens Advice 0808 278 7878.',
  ],
};

const landlordRepairs: Template = {
  id: 'landlord_repairs',
  product: 'cc',
  title: 'Repairs request to your landlord',
  short: 'Ask your landlord to fix damp, heating, leaks or other repairs',
  description: 'Letter from a tenant asking a landlord or housing association to carry out repairs (damp, mould, leaks, broken heating or boiler).',
  keywords: /repair|damp|mould|mold|leak|boiler|heating|landlord.*fix/i,
  kind: 'letter',
  fields: [
    { key: 'problems', label: 'What needs repairing', question: 'What needs repairing? Describe each problem and where it is in the home.', kind: 'longtext', tidy: true },
    { key: 'first_reported', label: 'When you first told them', question: 'When did you first tell your landlord? Say “not yet” if you haven’t.', kind: 'date', required: false, suggestions: ['Not yet'] },
    { key: 'impact', label: 'How it affects you', question: 'How is it affecting you or your family? For example health, cold, or rooms you can’t use.', kind: 'longtext', tidy: true, required: false },
    { key: 'deadline_days', label: 'Days to start repairs', question: 'How many days should they have to start the repairs?', kind: 'number', min: 1, max: 90, suggestions: ['14 days', '28 days'] },
    NAME,
    { ...ADDRESS, label: 'Your address (the rented home)', question: 'What’s the address of the home you rent, including postcode?' },
    { key: 'landlord_name', label: 'Landlord or housing association', question: 'What’s your landlord’s name, or the housing association or letting agent?', kind: 'name' },
    { key: 'landlord_address', label: 'Landlord’s address', question: 'What’s their address for letters? You can leave it blank.', kind: 'address', placeholderOk: true },
  ],
  render: (a, h) => {
    const blocks: Block[] = [
      para(`I am the tenant of the property above. I am writing to ask you to carry out repairs.`),
      para('The problems are:'),
      para(h.v('problems')),
    ];
    if (h.has('first_reported')) blocks.push(para(`I first reported this to you on ${h.date('first_reported')}, but the repairs have not been done.`));
    if (h.has('impact')) blocks.push(para(h.v('impact')));
    blocks.push(
      para(
        'As my landlord, you are responsible for keeping the structure and exterior of the property in repair, and the installations for the supply of water, gas, electricity, sanitation and heating in repair and proper working order (section 11 of the Landlord and Tenant Act 1985). You must also make sure the property is fit for human habitation (section 9A of the same Act).',
      ),
      para(`Please start the repairs within ${h.v('deadline_days', '14')} days of the date of this letter and tell me in writing when workers will visit. I will give reasonable access.`),
      para('If the repairs are not done, I may contact the council’s private housing team or the Housing Ombudsman, or get legal advice about my options.'),
    );
    return {
      title: 'Repairs request',
      kind: 'letter',
      sender: [h.v('your_name', LINE), ...h.lines('your_address')],
      recipient: [h.v('landlord_name'), ...(h.has('landlord_address') ? h.lines('landlord_address') : [`[address: ${LINE}]`])],
      date: h.today,
      subject: `Request for repairs at ${h.has('your_address') ? a.your_address.split('\n')[0] : 'my home'}`,
      salutation: `Dear ${h.v('landlord_name', 'Sir or Madam')},`,
      blocks,
      ...signOff(h, false),
    };
  },
  nextSteps: () => [
    'Send it by email and by post if you can, and keep a copy.',
    'Take dated photos of the problems and keep any messages you’ve sent.',
    'If nothing happens, contact Leeds City Council’s private housing team, or your housing association’s complaints process and then the Housing Ombudsman.',
    'Free help: Shelter 0808 800 4444.',
  ],
};

const depositReturn: Template = {
  id: 'deposit_return',
  product: 'cc',
  title: 'Deposit return request',
  short: 'Ask a landlord to return your tenancy deposit',
  description: 'Letter from a former tenant asking a landlord or letting agent to return the tenancy deposit, or disputing deductions.',
  keywords: /deposit/i,
  kind: 'letter',
  fields: [
    { key: 'property_address', label: 'Rented property', question: 'What was the address of the place you rented?', kind: 'address' },
    { key: 'tenancy_end', label: 'Tenancy ended', question: 'When did the tenancy end?', kind: 'date' },
    { key: 'deposit_amount', label: 'Deposit paid', question: 'How much deposit did you pay?', kind: 'money' },
    {
      key: 'deductions',
      label: 'What they’ve said',
      question: 'What has the landlord said about the deposit?',
      kind: 'choice',
      options: [
        { id: 'nothing', label: 'Nothing, or they’re keeping it all' },
        { id: 'some', label: 'They want to keep part of it' },
      ],
    },
    { key: 'disputed_reason', label: 'Why you disagree with deductions', question: 'Why do you disagree with what they want to keep?', kind: 'longtext', tidy: true, when: (a) => a.deductions === 'some' },
    NAME,
    { ...ADDRESS, label: 'Your current address', question: 'What’s your current address, for their reply?' },
    { key: 'landlord_name', label: 'Landlord or letting agent', question: 'What’s the landlord’s or letting agent’s name?', kind: 'name' },
    { key: 'landlord_address', label: 'Their address', question: 'What’s their address for letters? You can leave it blank.', kind: 'address', placeholderOk: true },
  ],
  render: (a, h) => {
    const blocks: Block[] = [
      para(`I was your tenant at ${h.has('property_address') ? a.property_address.replace(/\n/g, ', ') : '[property address]'} until ${h.date('tenancy_end')}. I paid a deposit of ${h.money('deposit_amount')}. I am writing to ask for my deposit back.`),
    ];
    if (a.deductions === 'some') {
      blocks.push(para('I do not agree with the deductions you propose because:'), para(h.v('disputed_reason')));
    }
    blocks.push(
      para(
        'My deposit should be protected in a government-approved tenancy deposit protection scheme (Housing Act 2004). Once we agree how much I will get back, the deposit should be returned within 10 days.',
      ),
      para('Please return my deposit within 14 days of the date of this letter, or tell me in writing which deductions you want to make and why, with your evidence.'),
      para('If we cannot agree, I will ask the deposit scheme’s free dispute resolution service to decide. Please tell me which scheme protects my deposit.'),
    );
    return {
      title: 'Deposit return request',
      kind: 'letter',
      sender: [h.v('your_name', LINE), ...h.lines('your_address')],
      recipient: [h.v('landlord_name'), ...(h.has('landlord_address') ? h.lines('landlord_address') : [`[address: ${LINE}]`])],
      date: h.today,
      subject: 'Return of my tenancy deposit',
      salutation: `Dear ${h.v('landlord_name', 'Sir or Madam')},`,
      blocks,
      ...signOff(h, false),
    };
  },
  nextSteps: () => [
    'Check which scheme holds your deposit on the Deposit Protection Service, mydeposits or TDS websites.',
    'If your deposit was never protected, you may be able to claim compensation of one to three times the deposit. Get advice before doing this.',
    'Keep your check-in and check-out photos, inventory and messages.',
    'Free help: Shelter 0808 800 4444.',
  ],
};

const debtPaymentOffer: Template = {
  id: 'debt_payment_offer',
  product: 'cc',
  title: 'Payment offer to a creditor',
  short: 'Offer an affordable payment and ask them to pause action',
  description: 'Letter to a lender, debt collector or council offering an affordable monthly payment on a debt and asking to freeze interest and charges.',
  keywords: /debt|creditor|arrears|payment plan|bailiff|collector|owe/i,
  kind: 'letter',
  fields: [
    { key: 'creditor_name', label: 'Who you owe', question: 'Who is the letter to? For example the lender, debt collector or council.', kind: 'name' },
    { key: 'account_ref', label: 'Account or reference number', question: 'What’s the account or reference number? You can leave it blank.', kind: 'text', placeholderOk: true },
    { key: 'amount_owed', label: 'Amount they say you owe', question: 'How much do they say you owe?', kind: 'money', required: false },
    { key: 'offer_monthly', label: 'Monthly offer', question: 'How much can you afford to pay each month after essentials like rent, food and bills?', kind: 'money', hint: 'Even £1 a month is a real offer if that’s what you can afford.' },
    { key: 'circumstances', label: 'Your situation', question: 'Briefly, what’s happened that means you can’t pay? For example job loss, illness or a benefit cut.', kind: 'longtext', tidy: true },
    { key: 'freeze', label: 'Ask to freeze interest', question: 'Do you want to ask them to freeze interest and charges and pause collection?', kind: 'yesno' },
    NAME,
    ADDRESS,
    { key: 'creditor_address', label: 'Their address', question: 'What’s their address for letters? You can leave it blank.', kind: 'address', placeholderOk: true },
  ],
  render: (a, h) => {
    const blocks: Block[] = [
      para(`I am writing about the account above${h.has('amount_owed') ? `, on which you say I owe ${h.money('amount_owed')}` : ''}. I am in financial difficulty and cannot pay the amount you have asked for.`),
      para(h.v('circumstances')),
      para(`I have worked out what I can afford after paying my essential living costs. I can offer to pay ${h.money('offer_monthly')} a month, starting next month.`),
    ];
    if (a.freeze === 'yes') blocks.push(para('Please freeze interest and charges on this account, and hold any collection or enforcement action, while you consider my offer.'));
    blocks.push(
      para('Financial Conduct Authority rules require lenders to treat customers in financial difficulty fairly, with forbearance and due consideration.'),
      para('Please confirm in writing that you accept this offer. I will tell you if my circumstances change.'),
    );
    return {
      title: 'Payment offer',
      kind: 'letter',
      sender: [h.v('your_name', LINE), ...h.lines('your_address')],
      recipient: [h.v('creditor_name'), ...(h.has('creditor_address') ? h.lines('creditor_address') : [`[address: ${LINE}]`])],
      date: h.today,
      refs: [`Account reference: ${h.v('account_ref', LINE)}`],
      subject: 'Offer of payment: financial difficulty',
      salutation: 'Dear Sir or Madam,',
      blocks,
      ...signOff(h, true),
    };
  },
  nextSteps: () => [
    'Start paying what you offered while you wait for a reply, so they can see you mean it.',
    'Free, confidential debt advice can check your budget and may apply for Breathing Space (60 days’ protection): Leeds Citizens Advice 0808 278 7878 or StepChange 0800 138 1111.',
    'Deal with priority debts first: rent, council tax and energy.',
  ],
};

const subjectAccessRequest: Template = {
  id: 'subject_access_request',
  product: 'cc',
  title: 'Subject access request',
  short: 'Ask an organisation for a copy of the information it holds about you',
  description: 'Letter or email under UK GDPR Article 15 asking an organisation (DWP, council, employer, landlord, company) for a copy of the personal data it holds.',
  keywords: /subject access|my data|information (they|you) hold|gdpr|copy of my (records|file|data)/i,
  kind: 'letter',
  fields: [
    { key: 'organisation', label: 'Organisation', question: 'Which organisation is it to?', kind: 'name' },
    { key: 'what_data', label: 'What you want', question: 'Is there particular information you want, like emails, call notes or a file about a decision? You can skip this to ask for everything.', kind: 'longtext', required: false },
    { key: 'account_ref', label: 'Reference number', question: 'Is there a customer, case or account number that helps them find you? You can skip this.', kind: 'text', required: false },
    NAME,
    ADDRESS,
    { key: 'org_address', label: 'Their address', question: 'What’s their address or email for data requests? You can leave it blank.', kind: 'address', placeholderOk: true },
  ],
  render: (a, h) => ({
    title: 'Subject access request',
    kind: 'letter',
    sender: [h.v('your_name', LINE), ...h.lines('your_address')],
    recipient: [`Data Protection Officer, ${h.v('organisation')}`, ...(h.has('org_address') ? h.lines('org_address') : [`[address: ${LINE}]`])],
    date: h.today,
    refs: h.has('account_ref') ? [`Reference: ${a.account_ref}`] : [],
    subject: 'Subject access request',
    salutation: 'Dear Data Protection Officer,',
    blocks: [
      para('Under Article 15 of the UK General Data Protection Regulation, I am asking for a copy of all the personal data you hold about me.'),
      ...(h.has('what_data') ? [para(`In particular, please include: ${a.what_data}`)] : []),
      para('Please also tell me why you are using my data, who you have shared it with, how long you will keep it, and where you got it from if not from me.'),
      para('You should respond within one month of receiving this request. If you need more information to confirm my identity or to find my data, please tell me promptly.'),
    ],
    ...signOff(h, false),
  }),
  nextSteps: () => [
    'Email it to their data protection or privacy address if they have one, and keep a copy.',
    'They usually have one month to reply, and it’s normally free.',
    'If they don’t reply, you can complain to the Information Commissioner’s Office (ico.org.uk).',
  ],
};

// ---------------------------------------------------------------------------
// Remedy: documents for businesses
// ---------------------------------------------------------------------------

const ourParty = (h: Helpers, prefix: 'our' | 'other') => {
  const name = h.v(`${prefix}_name`);
  const no = h.has(`${prefix}_company_number`) ? `, a company registered in England and Wales with number ${h.v(`${prefix}_company_number`)}` : '';
  const addr = h.has(`${prefix}_address`) ? `, of ${h.v(`${prefix}_address`).replace(/\n/g, ', ')}` : `, of [address: ${LINE}]`;
  return `${name}${no}${addr}`;
};

const sigBlock = (name: string): { label: string; lines: string[] } => ({
  label: `Signed for and on behalf of ${name}`,
  lines: ['Signature: ______________________________', 'Name: ___________________________________', 'Title: ____________________________________', 'Date: ____________________________________'],
});

const BUSINESS_PARTIES = (who: string): Field[] => [
  { key: 'our_name', label: 'Your business', question: 'What’s your business’s full legal name?', kind: 'name' },
  { key: 'our_company_number', label: 'Your company number', question: 'What’s your company number? Skip if you’re a sole trader.', kind: 'text', required: false },
  { key: 'our_address', label: 'Your address', question: 'What’s your business’s registered or trading address?', kind: 'address', placeholderOk: true },
  { key: 'other_name', label: who, question: `What’s the full legal name of the ${who.toLowerCase()}?`, kind: 'name' },
  { key: 'other_company_number', label: `${who} company number`, question: `What’s their company number? Skip if they’re an individual or you don’t know.`, kind: 'text', required: false },
  { key: 'other_address', label: `${who} address`, question: 'What’s their address?', kind: 'address', placeholderOk: true },
];

const businessPrefill = ({ business }: PrefillContext): Answers => {
  const out: Answers = {};
  if (business?.name) out.our_name = business.name;
  if (business?.companyNumber) out.our_company_number = business.companyNumber;
  return out;
};

const nda: Template = {
  id: 'nda',
  product: 'remedy',
  title: 'Non-disclosure agreement',
  short: 'Mutual or one-way NDA before sharing confidential information',
  description: 'Confidentiality agreement (NDA) between two businesses or a business and an individual before sharing confidential information.',
  keywords: /\bnda\b|non.?disclosure|confidentiality agreement/i,
  kind: 'agreement',
  fields: [
    {
      key: 'type',
      label: 'Type',
      question: 'Will both sides share confidential information, or only one?',
      kind: 'choice',
      options: [
        { id: 'mutual', label: 'Both sides (mutual)' },
        { id: 'we_disclose', label: 'Only us' },
        { id: 'they_disclose', label: 'Only them' },
      ],
    },
    ...BUSINESS_PARTIES('Other party'),
    { key: 'purpose', label: 'Purpose', question: 'What’s the information being shared for? For example “discussing a possible design project”.', kind: 'text' },
    { key: 'years', label: 'Years of confidentiality', question: 'How many years should the information stay confidential?', kind: 'number', min: 1, max: 10, suggestions: ['2 years', '3 years', '5 years'] },
    { key: 'effective_date', label: 'Start date', question: 'When should the agreement start?', kind: 'date', suggestions: ['Today'] },
  ],
  prefill: businessPrefill,
  render: (a, h) => {
    const mutual = a.type === 'mutual';
    const discloser = a.type === 'they_disclose' ? h.v('other_name') : h.v('our_name');
    const recipient = a.type === 'they_disclose' ? h.v('our_name') : h.v('other_name');
    const who = mutual ? 'each party' : recipient;
    return {
      title: mutual ? 'Mutual non-disclosure agreement' : 'Non-disclosure agreement',
      kind: 'agreement',
      date: `This agreement is dated ${h.date('effective_date')}.`,
      blocks: [
        { t: 'h', text: 'Parties' },
        { t: 'list', items: [`(1) ${ourParty(h, 'our')}.`, `(2) ${ourParty(h, 'other')}.`] },
        { t: 'h', text: 'Background' },
        para(
          mutual
            ? `The parties wish to share confidential information with each other for the following purpose: ${h.v('purpose')} (the "Purpose"). This agreement sets out how that information must be protected.`
            : `${discloser} wishes to share confidential information with ${recipient} for the following purpose: ${h.v('purpose')} (the "Purpose"). This agreement sets out how that information must be protected.`,
        ),
        { t: 'h', text: 'Agreed terms' },
        {
          t: 'clause',
          num: '1.',
          title: 'Confidential information',
          text: `"Confidential Information" means all information of a confidential nature disclosed ${mutual ? 'by one party to the other' : `by ${discloser} to ${recipient}`} in connection with the Purpose, in any form, whether before or after the date of this agreement, including business, financial, technical and customer information, and any information marked or described as confidential.`,
        },
        {
          t: 'clause',
          num: '2.',
          title: 'Obligations',
          text: `${mutual ? 'Each party receiving Confidential Information' : recipient} must:`,
          subs: [
            'keep the Confidential Information secret and protect it with at least the care it uses for its own confidential information, and no less than reasonable care;',
            'use it only for the Purpose; and',
            'disclose it only to its employees, officers, contractors and professional advisers who need to know it for the Purpose and who are bound by confidentiality obligations no less strict than these, and it is responsible for their compliance.',
          ],
        },
        {
          t: 'clause',
          num: '3.',
          title: 'Exceptions',
          text: 'The obligations in clause 2 do not apply to information that:',
          subs: [
            'is or becomes public other than through a breach of this agreement;',
            'the recipient can show it already lawfully knew before disclosure;',
            'the recipient receives lawfully from a third party who is free to disclose it; or',
            'the recipient develops independently without using the Confidential Information.',
          ],
        },
        {
          t: 'clause',
          num: '4.',
          title: 'Disclosure required by law',
          text: 'A recipient may disclose Confidential Information to the extent required by law, a court or a regulator, provided that (where lawful) it gives the disclosing party prompt notice so it can seek protection, and discloses only what is required.',
        },
        {
          t: 'clause',
          num: '5.',
          title: 'Return and destruction',
          text: 'On written request, the recipient must promptly return or destroy the Confidential Information, except copies it must keep by law or that are held in routine electronic back-ups, which remain subject to this agreement.',
        },
        {
          t: 'clause',
          num: '6.',
          title: 'Duration',
          text: `The obligations in this agreement continue for ${h.v('years', '3')} years from the date of this agreement, except that trade secrets must be kept confidential for as long as they remain trade secrets.`,
        },
        {
          t: 'clause',
          num: '7.',
          title: 'No licence or commitment',
          text: 'All Confidential Information remains the property of the party that disclosed it. Nothing in this agreement grants any licence or rights in it, or obliges either party to enter into any further agreement or transaction.',
        },
        {
          t: 'clause',
          num: '8.',
          title: 'Remedies',
          text: 'Damages alone may not be an adequate remedy for a breach of this agreement, and the disclosing party may seek an injunction or other equitable relief in addition to any other remedy.',
        },
        {
          t: 'clause',
          num: '9.',
          title: 'General',
          subs: [
            'This agreement is the entire agreement between the parties about its subject matter.',
            'Any change to this agreement must be in writing and signed by both parties.',
            'Neither party may assign this agreement without the other’s written consent.',
            'A person who is not a party has no right under the Contracts (Rights of Third Parties) Act 1999 to enforce any term of this agreement.',
            'This agreement may be signed in counterparts, including electronically.',
          ],
        },
        {
          t: 'clause',
          num: '10.',
          title: 'Governing law and jurisdiction',
          text: 'This agreement and any dispute arising from it are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.',
        },
      ],
      signatures: [sigBlock(h.v('our_name')), sigBlock(h.v('other_name'))],
    };
  },
  nextSteps: () => [
    'Read it through with the other side and agree any changes before anyone signs.',
    'Both parties sign. An e-signature is fine for an NDA.',
    'Send it before sharing any confidential information, and label what you share as confidential.',
  ],
};

const freelancerAgreement: Template = {
  id: 'freelancer_agreement',
  product: 'remedy',
  title: 'Freelancer services agreement',
  short: 'Agreement for hiring a freelancer or contractor',
  description: 'Services or consultancy agreement between a business and a freelancer, contractor or consultant, covering services, fees, IP and status.',
  keywords: /freelanc|contractor|consultan|services agreement|self.?employed/i,
  kind: 'agreement',
  fields: [
    {
      key: 'role',
      label: 'Your role',
      question: 'Are you hiring a freelancer, or are you the freelancer?',
      kind: 'choice',
      options: [
        { id: 'hiring', label: 'We’re hiring a freelancer' },
        { id: 'freelancer', label: 'We are the freelancer' },
      ],
    },
    ...BUSINESS_PARTIES('Other party'),
    { key: 'services', label: 'The work', question: 'What work will the freelancer do? Include deliverables and any deadlines.', kind: 'longtext', tidy: true },
    { key: 'start_date', label: 'Start date', question: 'When does the work start?', kind: 'date', suggestions: ['Today'] },
    {
      key: 'fee_basis',
      label: 'How fees work',
      question: 'How will the freelancer be paid?',
      kind: 'choice',
      options: [
        { id: 'day', label: 'A day rate' },
        { id: 'hour', label: 'An hourly rate' },
        { id: 'fixed', label: 'A fixed fee' },
      ],
    },
    { key: 'fee_amount', label: 'Fee', question: 'How much is the rate or fee (before VAT)?', kind: 'money' },
    { key: 'payment_days', label: 'Days to pay invoices', question: 'How many days does the client have to pay each invoice?', kind: 'number', min: 1, max: 60, suggestions: ['14 days', '30 days'] },
    {
      key: 'ip',
      label: 'Who owns the work',
      question: 'Who should own what the freelancer creates?',
      kind: 'choice',
      options: [
        { id: 'assign', label: 'The client, once paid' },
        { id: 'licence', label: 'The freelancer, with a licence to the client' },
      ],
    },
    { key: 'substitution', label: 'Can send a substitute', question: 'Can the freelancer send someone suitably skilled in their place?', kind: 'yesno' },
    { key: 'notice_days', label: 'Notice to end', question: 'How many days’ written notice should either side give to end the agreement?', kind: 'number', min: 0, max: 180, suggestions: ['7 days', '14 days', '30 days'] },
  ],
  prefill: businessPrefill,
  warnings: () => ['Employment status depends on how the work happens in practice, not just on this contract. If the freelancer works like an employee (fixed hours, your control, no substitution), they may be an employee or worker, or within IR35 rules.'],
  render: (a, h) => {
    const client = a.role === 'freelancer' ? h.v('other_name') : h.v('our_name');
    const freelancer = a.role === 'freelancer' ? h.v('our_name') : h.v('other_name');
    const basis = { day: 'per day worked', hour: 'per hour worked', fixed: 'as a fixed fee for the Services' }[a.fee_basis] ?? '';
    return {
      title: 'Freelancer services agreement',
      kind: 'agreement',
      date: `This agreement is dated ${h.date('start_date')}.`,
      blocks: [
        { t: 'h', text: 'Parties' },
        {
          t: 'list',
          items: [
            `(1) ${ourParty(h, a.role === 'freelancer' ? 'other' : 'our')} (the "Client").`,
            `(2) ${ourParty(h, a.role === 'freelancer' ? 'our' : 'other')} (the "Freelancer").`,
          ],
        },
        { t: 'h', text: 'Agreed terms' },
        { t: 'clause', num: '1.', title: 'Services', text: `The Freelancer will provide the following services to the Client (the "Services"), starting on ${h.date('start_date')}: ${h.v('services')}` },
        {
          t: 'clause',
          num: '2.',
          title: 'How the Services are performed',
          subs: [
            'The Freelancer will perform the Services with reasonable skill and care, and decides how, when and where to carry them out, subject to agreed deadlines.',
            'The Freelancer provides their own equipment unless agreed otherwise.',
            a.substitution === 'yes'
              ? 'The Freelancer may send a suitably skilled and qualified substitute to perform the Services, at the Freelancer’s own cost, after telling the Client. The confidentiality and intellectual property terms of this agreement bind any substitute.'
              : 'The Freelancer will perform the Services personally.',
            'The Freelancer may work for other clients during this agreement.',
          ],
        },
        {
          t: 'clause',
          num: '3.',
          title: 'Fees and payment',
          subs: [
            `The Client will pay the Freelancer ${h.money('fee_amount')} ${basis}, plus VAT if applicable.`,
            `The Freelancer will invoice the Client ${a.fee_basis === 'fixed' ? 'on completion, or as agreed in writing' : 'monthly in arrears'}, and the Client will pay each valid invoice within ${h.v('payment_days', '30')} days of receiving it.`,
            'If the Client pays late, the Freelancer may claim interest and compensation under the Late Payment of Commercial Debts (Interest) Act 1998.',
            'The Client will reimburse reasonable expenses only if it approved them in writing in advance.',
          ],
        },
        {
          t: 'clause',
          num: '4.',
          title: 'Status',
          text: 'The Freelancer is an independent contractor and not an employee or worker of the Client. The Freelancer is responsible for their own income tax and National Insurance contributions, and will indemnify the Client against any such liability arising from the Services.',
        },
        {
          t: 'clause',
          num: '5.',
          title: 'Intellectual property',
          text:
            a.ip === 'licence'
              ? 'The Freelancer keeps ownership of all intellectual property in the work it creates for the Services. On payment, the Freelancer grants the Client a non-exclusive, perpetual, royalty-free licence to use that work for the Client’s business.'
              : 'On payment in full for the relevant work, the Freelancer assigns to the Client all intellectual property in the work it creates for the Services, and waives any moral rights in it. The Freelancer keeps ownership of its pre-existing materials and grants the Client a licence to use them as part of the work.',
        },
        {
          t: 'clause',
          num: '6.',
          title: 'Confidentiality and data',
          subs: [
            'Each party will keep confidential the other’s confidential information that it receives under this agreement, and use it only for this agreement. This continues after the agreement ends.',
            'Each party will comply with data protection law, including the UK GDPR, in relation to any personal data handled under this agreement.',
          ],
        },
        {
          t: 'clause',
          num: '7.',
          title: 'Liability',
          text: 'Each party’s total liability under this agreement is limited to the total fees paid or payable in the 12 months before the claim. Neither party limits or excludes liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot be limited by law.',
        },
        {
          t: 'clause',
          num: '8.',
          title: 'Ending the agreement',
          subs: [
            `Either party may end this agreement by giving ${h.v('notice_days', '14')} days’ written notice.`,
            'Either party may end it immediately by written notice if the other seriously breaches it and does not fix the breach within 14 days of being asked to.',
            'On ending, the Client will pay for Services properly performed up to the end date.',
          ],
        },
        {
          t: 'clause',
          num: '9.',
          title: 'General',
          subs: [
            'This agreement is the entire agreement between the parties about the Services.',
            'Any change must be in writing and signed by both parties.',
            'A person who is not a party has no right under the Contracts (Rights of Third Parties) Act 1999 to enforce any term of this agreement.',
            'This agreement is governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.',
          ],
        },
      ],
      signatures: [sigBlock(client), sigBlock(freelancer)],
    };
  },
  nextSteps: () => [
    'Agree the wording with the other side before work starts, and both sign.',
    'Keep the reality matching the contract: the freelancer should control how they work.',
    'Check HMRC’s employment status tool (CEST) if you’re unsure about status or IR35.',
  ],
};

/** Fixed compensation under the Late Payment of Commercial Debts (Interest) Act 1998, s.5A. */
export function lateCompensationPence(debtPence: number) {
  if (debtPence < 100_000) return 4_000;
  if (debtPence < 1_000_000) return 7_000;
  return 10_000;
}

const invoiceDemand: Template = {
  id: 'invoice_demand',
  product: 'remedy',
  title: 'Letter before action: unpaid invoice',
  short: 'Formal demand for an unpaid invoice before going to court',
  description: 'Letter before action / letter before claim demanding payment of an overdue invoice, with statutory late-payment interest and compensation.',
  keywords: /unpaid|invoice|late pay|owe[sd]? (me|us)|letter before (action|claim)|chase.*payment|debt recovery/i,
  kind: 'letter',
  fields: [
    { key: 'our_name', label: 'Your business', question: 'What’s your business’s full legal name?', kind: 'name' },
    { key: 'our_address', label: 'Your address', question: 'What’s your business address?', kind: 'address', placeholderOk: true },
    { key: 'other_name', label: 'Who owes you', question: 'Who owes you the money? Give their full legal name.', kind: 'name' },
    { key: 'debtor_business', askDirectly: true, label: 'They’re a business', question: 'Are they a business (a company or partnership), rather than an individual or sole trader?', kind: 'yesno', hint: 'Different rules apply when the debtor is an individual.' },
    { key: 'other_address', label: 'Their address', question: 'What’s their address?', kind: 'address', placeholderOk: true },
    { key: 'invoices', label: 'Invoice numbers', question: 'Which invoice number or numbers?', kind: 'text' },
    { key: 'amount', label: 'Amount unpaid', question: 'How much is unpaid in total, including VAT?', kind: 'money' },
    { key: 'due_date', label: 'Due date', question: 'When was payment due?', kind: 'date' },
    {
      key: 'contract_interest',
      askDirectly: true,
      label: 'Contract sets late interest',
      question: 'Does your contract or terms set their own late-payment interest rate?',
      kind: 'yesno',
      when: (a) => a.debtor_business === 'yes',
    },
    {
      key: 'base_rate',
      label: 'Bank of England base rate',
      question: 'To work out interest, what was the Bank of England base rate on the last 30 June or 31 December before the due date? You can skip this and we’ll describe the rate instead.',
      kind: 'percent',
      required: false,
      when: (a) => a.debtor_business === 'yes' && a.contract_interest === 'no',
    },
  ],
  prefill: businessPrefill,
  warnings: (a) => (a.debtor_business === 'no' ? ['Because they’re an individual, the Pre-Action Protocol for Debt Claims applies: give them 30 days, and send the Information Sheet and Reply Form (free on GOV.UK) with this letter.'] : []),
  render: (a, h) => {
    const b2b = a.debtor_business === 'yes';
    const statutory = b2b && a.contract_interest === 'no';
    const debt = h.has('amount') ? Number(a.amount) : 0;
    const comp = lateCompensationPence(debt);
    const days = b2b ? 14 : 30;
    const blocks: Block[] = [
      para(`We supplied goods or services to you under invoice ${h.v('invoices')}, totalling ${h.money('amount')}. Payment was due on ${h.date('due_date')}. Despite the payment terms, the invoice remains unpaid.`),
    ];
    let totalNote = h.money('amount');
    if (statutory) {
      blocks.push(para(`Under the Late Payment of Commercial Debts (Interest) Act 1998, we are entitled to statutory interest at 8% a year above the Bank of England base rate from ${h.date('due_date')}, and to fixed compensation of ${formatPence(comp)}.`));
      if (h.has('base_rate') && h.has('due_date') && h.todayIso > a.due_date) {
        const rate = (8 + Number(a.base_rate)) / 100;
        const daysLate = daysBetween(a.due_date, h.todayIso);
        const daily = Math.round((debt * rate) / 365);
        const interest = daily * daysLate;
        blocks.push(para(`Interest at ${(rate * 100).toFixed(2)}% a year for ${daysLate} days to the date of this letter is ${formatPence(interest)}, and continues at ${formatPence(daily)} a day until payment.`));
        totalNote = `${formatPence(debt + comp + interest)} (the invoice, compensation and interest to date)`;
      } else {
        totalNote = `${h.money('amount')}, plus the fixed compensation and statutory interest`;
      }
    } else if (b2b) {
      blocks.push(para('We are also entitled to interest on the late payment under the terms of our contract.'));
    }
    blocks.push(
      para(`Please pay ${totalNote} within ${days} days of the date of this letter. Our bank details are: [account name, sort code and account number].`),
      para('If you dispute the amount or believe you have a good reason for not paying, please tell us in writing within this period, with your reasons and any documents you rely on.'),
      para(`If we do not receive payment or a reasoned response within ${days} days, we may start court proceedings against you without further notice. This may increase the amount you have to pay, because we may also claim court fees and costs.`),
      para('We would prefer to resolve this without going to court. If you cannot pay in full, please contact us to discuss a payment plan. We are open to resolving this through mediation.'),
    );
    if (!b2b) blocks.push(para('We enclose an Information Sheet and Reply Form, as required by the Pre-Action Protocol for Debt Claims. Please complete and return the Reply Form within 30 days.'));
    return {
      title: 'Letter before action',
      kind: 'letter',
      sender: [h.v('our_name'), ...h.lines('our_address')],
      recipient: [h.v('other_name'), ...(h.has('other_address') ? h.lines('other_address') : [`[address: ${LINE}]`])],
      date: h.today,
      refs: [`Invoice: ${h.v('invoices')}`],
      subject: `Letter before action: unpaid invoice ${h.v('invoices')} (${h.money('amount')})`,
      salutation: 'Dear Sir or Madam,',
      blocks,
      closing: 'Yours faithfully,',
      signatures: [{ label: '', lines: ['', '', '______________________________', `For and on behalf of ${h.v('our_name')}`] }],
    };
  },
  nextSteps: (a) => [
    'Fill in your bank details, sign it and send it by email and recorded post. Keep proof of sending.',
    a.debtor_business === 'no'
      ? 'Send the Pre-Action Protocol Information Sheet and Reply Form with it, and wait 30 days.'
      : 'Wait the 14 days. Many debts are paid at this stage.',
    'If they still don’t pay, you can claim online through Money Claim Online for claims up to £100,000. Small claims are offered free mediation.',
    'Ask a Remedy lawyer before issuing a claim if the debt is large or disputed.',
  ],
};

export const TEMPLATES: Template[] = [
  mandatoryReconsideration,
  landlordRepairs,
  depositReturn,
  debtPaymentOffer,
  subjectAccessRequest,
  nda,
  freelancerAgreement,
  invoiceDemand,
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);
export const templatesFor = (product: Product) => TEMPLATES.filter((t) => t.product === product);

/**
 * Documents we never draft: reserved legal activities, court forms, or
 * documents where a template is unsafe. Each points somewhere that can help.
 */
export const OUT_OF_SCOPE: { match: RegExp; what: string; cc: string; remedy: string }[] = [
  { match: /\bwills?\b|probate|estate of|executor/i, what: 'wills and probate documents', cc: 'Citizens Advice can point you to free or low-cost will services.', remedy: 'A partner law firm can prepare these.' },
  { match: /transfer.*(property|house|land)|conveyanc|sale of (a )?(house|property)|title deed|mortgage deed/i, what: 'property transfers and land documents', cc: 'Only a regulated lawyer can prepare these.', remedy: 'This is a reserved legal activity: a partner law firm must do it.' },
  { match: /\blease\b|tenancy agreement/i, what: 'leases and tenancy agreements', cc: 'Shelter (0808 800 4444) can explain your tenancy.', remedy: 'A Remedy lawyer or partner firm can draft or review a lease.' },
  { match: /claim form|n1 form|defen[cs]e|witness statement|court (form|application)|tribunal (claim|form|appeal)/i, what: 'court and tribunal forms', cc: 'Citizens Advice can help you fill in court and tribunal forms.', remedy: 'A Remedy lawyer can help with court forms.' },
  { match: /divorce|separation agreement|child arrangements|financial order|prenup/i, what: 'family law documents', cc: 'Citizens Advice can point you to free family law help.', remedy: 'A partner law firm can help.' },
  { match: /power of attorney|\blpa\b/i, what: 'powers of attorney', cc: 'Use the official forms on GOV.UK (Office of the Public Guardian).', remedy: 'Use the official forms on GOV.UK (Office of the Public Guardian).' },
  { match: /shareholders?'? agreement|articles of association|share (purchase|subscription)|term sheet|employment contract/i, what: 'this kind of company or employment document', cc: 'Citizens Advice can help.', remedy: 'A Remedy lawyer or partner firm should draft this. Ask Remedy and we’ll route it.' },
];

/** Cheap check before calling the AI: does this message ask for a document? */
export const DRAFT_INTENT =
  /\b(draft|write|prepare|make|create|need|want|get)\b.{0,40}\b(letter|document|agreement|contract|nda|request|complaint|template|notice|demand)\b|\blegal draft\b|\bdraft (a|an|me|my|the)\b|\bletter before (action|claim)\b/i;

export const looksLikeDraftRequest = (text: string) => DRAFT_INTENT.test(text);

/**
 * Starter corpus (mvp2.md §6.1). Each entry names a legislation.gov.uk section
 * (or a GOV.UK guide part) that `legislation.ingestAll` fetches, parses and
 * embeds. `fixture` is a short hand-written summary used only when the live
 * fetch fails on demo day; it is stored with source 'fixture' and the next
 * ingest replaces it with the official text.
 *
 * Sources: legislation.gov.uk and GOV.UK, Open Government Licence v3.0.
 * No case law in the MVP.
 */

export type CorpusEntry =
  | {
      kind: 'legislation';
      act: string;
      path: string; // e.g. 'ukpga/1996/18'
      unit: 'section' | 'article';
      section: string;
      heading: string;
      topics: string[];
      fixture: string;
    }
  | {
      kind: 'govuk';
      act: string; // guide title
      path: string; // e.g. '/employment-status'
      part: string; // part slug
      section: string; // part title, shown as the "section"
      heading: string;
      topics: string[];
      fixture: string;
    };

const ERA = { act: 'Employment Rights Act 1996', path: 'ukpga/1996/18', unit: 'section', kind: 'legislation' } as const;
const NMWA = { act: 'National Minimum Wage Act 1998', path: 'ukpga/1998/39', unit: 'section', kind: 'legislation' } as const;
const EQA = { act: 'Equality Act 2010', path: 'ukpga/2010/15', unit: 'section', kind: 'legislation' } as const;
const CA = { act: 'Companies Act 2006', path: 'ukpga/2006/46', unit: 'section', kind: 'legislation' } as const;
const CRA = { act: 'Consumer Rights Act 2015', path: 'ukpga/2015/15', unit: 'section', kind: 'legislation' } as const;
const GDPR = { act: 'UK GDPR', path: 'eur/2016/679', unit: 'article', kind: 'legislation' } as const;
const DPA = { act: 'Data Protection Act 2018', path: 'ukpga/2018/12', unit: 'section', kind: 'legislation' } as const;
const LP = { act: 'Late Payment of Commercial Debts (Interest) Act 1998', path: 'ukpga/1998/20', unit: 'section', kind: 'legislation' } as const;
const CDPA = { act: 'Copyright, Designs and Patents Act 1988', path: 'ukpga/1988/48', unit: 'section', kind: 'legislation' } as const;
const TMA = { act: 'Trade Marks Act 1994', path: 'ukpga/1994/26', unit: 'section', kind: 'legislation' } as const;
const LTA = { act: 'Landlord and Tenant Act 1954', path: 'ukpga/Eliz2/2-3/56', unit: 'section', kind: 'legislation' } as const;

export const CORPUS: CorpusEntry[] = [
  // ---- Employment ----
  { ...ERA, section: '1', heading: 'Statement of initial employment particulars', topics: ['employment'],
    fixture: 'An employer must give a worker a written statement of particulars of employment, including pay, hours, holiday and notice, no later than the day the work starts.' },
  { ...ERA, section: '13', heading: 'Right not to suffer unauthorised deductions', topics: ['employment'],
    fixture: 'An employer must not make a deduction from a worker’s wages unless it is required or authorised by law or a term of the contract, or the worker has previously agreed to it in writing.' },
  { ...ERA, section: '86', heading: 'Rights of employer and employee to minimum notice', topics: ['employment'],
    fixture: 'After one month’s continuous employment an employee is entitled to at least one week’s notice, rising to one week per complete year of service from two years, up to twelve weeks. The employee must give at least one week’s notice.' },
  { ...ERA, section: '94', heading: 'The right not to be unfairly dismissed', topics: ['employment'],
    fixture: 'An employee has the right not to be unfairly dismissed by their employer, subject to the rest of Part X of the Act.' },
  { ...ERA, section: '108', heading: 'Qualifying period of employment', topics: ['employment'],
    fixture: 'The right not to be unfairly dismissed generally needs a qualifying period of continuous employment, with many exceptions (for example dismissals for whistleblowing or health and safety reasons). Check for changes made by the Employment Rights Act 2025.' },
  { ...ERA, section: '230', heading: 'Employees, workers etc.', topics: ['employment'],
    fixture: '“Employee” means an individual working under a contract of employment. “Worker” also includes an individual working under any other contract to personally do work for another party who is not their client or customer of a business they run.' },
  { ...NMWA, section: '1', heading: 'Workers to be paid at least the national minimum wage', topics: ['employment'],
    fixture: 'A person who is a worker, who works or ordinarily works in the UK and is over compulsory school age, must be paid at least the national minimum wage.' },
  { ...NMWA, section: '54', heading: 'Meaning of “worker”, “employee” etc.', topics: ['employment'],
    fixture: 'For minimum wage purposes, “worker” includes anyone working under a contract of employment or any other contract to personally perform work, unless the other party is their client or customer.' },
  { ...EQA, section: '4', heading: 'The protected characteristics', topics: ['employment', 'consumer'],
    fixture: 'The protected characteristics are age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex, and sexual orientation.' },
  { ...EQA, section: '13', heading: 'Direct discrimination', topics: ['employment', 'consumer'],
    fixture: 'A person discriminates against another if, because of a protected characteristic, they treat that person less favourably than they treat or would treat others.' },
  { ...EQA, section: '20', heading: 'Duty to make adjustments', topics: ['employment'],
    fixture: 'Where a provision, criterion or practice, a physical feature, or the lack of an auxiliary aid puts a disabled person at a substantial disadvantage, there is a duty to take reasonable steps to avoid the disadvantage.' },
  { ...EQA, section: '39', heading: 'Employees and applicants', topics: ['employment'],
    fixture: 'An employer must not discriminate against job applicants in its recruitment arrangements, terms offered or by not offering employment, nor against employees in their terms, opportunities, dismissal or any other detriment.' },

  // ---- Company ----
  { ...CA, section: '21', heading: 'Amendment of articles', topics: ['company'],
    fixture: 'A company may amend its articles of association by special resolution.' },
  { ...CA, section: '168', heading: 'Resolution to remove director', topics: ['company'],
    fixture: 'A company may remove a director before the end of their term by ordinary resolution at a meeting, despite anything in an agreement with them. Special notice is required.' },
  { ...CA, section: '171', heading: 'Duty to act within powers', topics: ['company'],
    fixture: 'A director must act in accordance with the company’s constitution and only exercise powers for the purposes for which they are conferred.' },
  { ...CA, section: '172', heading: 'Duty to promote the success of the company', topics: ['company'],
    fixture: 'A director must act in the way they consider, in good faith, would be most likely to promote the success of the company for the benefit of its members as a whole, having regard to long-term consequences, employees, suppliers and customers, the community and environment, reputation, and fairness between members.' },
  { ...CA, section: '174', heading: 'Duty to exercise reasonable care, skill and diligence', topics: ['company'],
    fixture: 'A director must exercise the care, skill and diligence of a reasonably diligent person with the general knowledge, skill and experience expected of someone in that role, and that the director actually has.' },
  { ...CA, section: '175', heading: 'Duty to avoid conflicts of interest', topics: ['company'],
    fixture: 'A director must avoid situations in which they have, or could have, a direct or indirect interest that conflicts with the company’s interests, unless authorised by the directors where the constitution allows.' },
  { ...CA, section: '550', heading: 'Power of directors to allot shares etc: private company with only one class of shares', topics: ['company'],
    fixture: 'Where a private company has only one class of shares, the directors may allot shares of that class unless the articles prohibit it.' },
  { ...CA, section: '551', heading: 'Power of directors to allot shares etc: authorisation by company', topics: ['company'],
    fixture: 'The directors may allot shares if authorised to do so by the articles or by a resolution of the company, which must state the maximum number of shares and an expiry date of no more than five years.' },
  { ...CA, section: '555', heading: 'Return of allotment by limited company', topics: ['company'],
    fixture: 'Within one month of allotting shares, a limited company must deliver a return of allotment (with a statement of capital) to the registrar at Companies House.' },
  { ...CA, section: '561', heading: 'Existing shareholders’ right of pre-emption', topics: ['company'],
    fixture: 'Before allotting equity securities for cash, a company must first offer them to existing ordinary shareholders in proportion to their holdings, unless the right is excluded or disapplied.' },

  // ---- Contracts and getting paid ----
  { ...LP, section: '1', heading: 'Statutory interest', topics: ['contracts'],
    fixture: 'It is an implied term of a business-to-business contract for goods or services that a qualifying debt carries simple interest at the statutory rate (set by order; 8% above the Bank of England reference rate).' },
  { ...LP, section: '4', heading: 'Period for which statutory interest runs', topics: ['contracts'],
    fixture: 'Statutory interest runs from the day after the agreed payment date or, if none was agreed, from 30 days after the later of delivery and the customer receiving notice of the debt.' },
  { ...LP, section: '5A', heading: 'Compensation arising out of late payment', topics: ['contracts'],
    fixture: 'When statutory interest starts to run, the supplier is also entitled to a fixed sum: £40 for debts under £1,000, £70 for £1,000 to under £10,000, and £100 for £10,000 or more, plus reasonable recovery costs above that.' },

  // ---- Consumers ----
  { ...CRA, section: '9', heading: 'Goods to be of satisfactory quality', topics: ['consumer'],
    fixture: 'Every contract to supply goods to a consumer is treated as including a term that the goods are of satisfactory quality.' },
  { ...CRA, section: '22', heading: 'Time limit for short-term right to reject', topics: ['consumer'],
    fixture: 'A consumer’s short-term right to reject faulty goods generally lasts 30 days from when ownership passes, the goods are delivered and the trader has done anything needed for the consumer to use them.' },
  { ...CRA, section: '49', heading: 'Service to be performed with reasonable care and skill', topics: ['consumer'],
    fixture: 'Every contract to supply a service to a consumer is treated as including a term that the trader must perform the service with reasonable care and skill.' },
  { ...CRA, section: '62', heading: 'Requirement for contract terms and notices to be fair', topics: ['consumer', 'contracts'],
    fixture: 'An unfair term of a consumer contract is not binding on the consumer. A term is unfair if, contrary to good faith, it causes a significant imbalance in the parties’ rights and obligations to the consumer’s detriment.' },

  // ---- Data ----
  { ...GDPR, section: '5', heading: 'Principles relating to processing of personal data', topics: ['data'],
    fixture: 'Personal data must be processed lawfully, fairly and transparently; collected for specified purposes; adequate and limited to what is necessary; accurate; kept no longer than necessary; and kept secure. The controller must be able to show compliance.' },
  { ...GDPR, section: '6', heading: 'Lawfulness of processing', topics: ['data'],
    fixture: 'Processing is lawful only if a lawful basis applies: consent, contract, legal obligation, vital interests, public task, or legitimate interests (balanced against the individual’s rights).' },
  { ...GDPR, section: '13', heading: 'Information to be provided where personal data are collected from the data subject', topics: ['data'],
    fixture: 'When collecting personal data from a person, the controller must tell them who it is, the purposes and lawful basis, who receives the data, how long it is kept and the person’s rights.' },
  { ...GDPR, section: '28', heading: 'Processor', topics: ['data', 'contracts'],
    fixture: 'A controller may only use processors that give sufficient guarantees, and processing must be governed by a written contract setting out the subject matter, duration, nature and purpose of processing and the processor’s obligations.' },
  { ...GDPR, section: '33', heading: 'Notification of a personal data breach to the supervisory authority', topics: ['data'],
    fixture: 'A controller must report a personal data breach to the Information Commissioner without undue delay and, where feasible, within 72 hours of becoming aware of it, unless it is unlikely to result in a risk to people’s rights and freedoms.' },
  { ...DPA, section: '170', heading: 'Unlawful obtaining etc of personal data', topics: ['data'],
    fixture: 'It is an offence knowingly or recklessly to obtain or disclose personal data without the consent of the controller, subject to defences.' },

  // ---- IP ----
  { ...CDPA, section: '1', heading: 'Copyright and copyright works', topics: ['ip'],
    fixture: 'Copyright subsists in original literary, dramatic, musical or artistic works, sound recordings, films, broadcasts and the typographical arrangement of published editions.' },
  { ...CDPA, section: '11', heading: 'First ownership of copyright', topics: ['ip', 'employment'],
    fixture: 'The author of a work is the first owner of its copyright. Where a work is made by an employee in the course of employment, the employer is the first owner, subject to any agreement to the contrary. Freelancers are not employees for this purpose.' },
  { ...CDPA, section: '90', heading: 'Assignment and licences', topics: ['ip', 'contracts'],
    fixture: 'Copyright can be transferred by assignment, but an assignment only takes effect if it is in writing and signed by or on behalf of the assignor.' },
  { ...TMA, section: '1', heading: 'Trade marks', topics: ['ip'],
    fixture: 'A trade mark is any sign capable of being represented in the register and of distinguishing the goods or services of one business from those of others.' },
  { ...TMA, section: '9', heading: 'Rights conferred by registered trade mark', topics: ['ip'],
    fixture: 'The owner of a registered trade mark has exclusive rights in it, which are infringed by use of the mark in the UK without their consent.' },
  { ...TMA, section: '10', heading: 'Infringement of registered trade mark', topics: ['ip'],
    fixture: 'A person infringes by using in the course of trade a sign identical to the mark for identical goods or services, or a similar sign where there is a likelihood of confusion, or a sign that takes unfair advantage of a mark with a reputation.' },

  // ---- Premises ----
  { ...LTA, section: '24', heading: 'Continuation of tenancies to which Part II applies and grant of new tenancies', topics: ['property'],
    fixture: 'A business tenancy protected by Part II does not end at the end of the term unless ended under the Act, and the tenant may apply to court for a new tenancy.' },
  { ...LTA, section: '25', heading: 'Termination of tenancy by the landlord', topics: ['property'],
    fixture: 'A landlord may end a protected business tenancy by notice in the prescribed form given between six and twelve months before the termination date, stating whether it would oppose a new tenancy.' },
  { ...LTA, section: '30', heading: 'Opposition by landlord to application for new tenancy', topics: ['property'],
    fixture: 'A landlord may oppose a new business tenancy only on the grounds listed, such as disrepair, persistent arrears, other breaches, suitable alternative accommodation, demolition or reconstruction, or occupying the premises itself.' },
  { ...LTA, section: '38A', heading: 'Agreements to exclude provisions of Part II', topics: ['property'],
    fixture: 'Landlord and tenant may agree that the security of tenure provisions will not apply (contracting out), but only if the prescribed notice and declaration procedure is followed before the tenancy starts.' },

  // ---- GOV.UK guidance ----
  { kind: 'govuk', act: 'GOV.UK: Employment status', path: '/employment-status', part: 'worker', section: 'Worker', heading: 'Worker', topics: ['employment'],
    fixture: 'A person is generally a worker if they have a contract or arrangement to do work personally for a reward, have limited rights to send someone else, and the employer must offer work while they must do it. Workers are entitled to the minimum wage, paid holiday and rest breaks.' },
  { kind: 'govuk', act: 'GOV.UK: Employment status', path: '/employment-status', part: 'selfemployed-contractor', section: 'Self-employed and contractor', heading: 'Self-employed and contractor', topics: ['employment'],
    fixture: 'Someone is likely self-employed if they run their own business, can decide how and when to work, can send someone else (substitution), use their own equipment and can make a loss. Employment status depends on the facts of the relationship, not just the contract’s label.' },
  { kind: 'govuk', act: 'GOV.UK: Late commercial payments', path: '/late-commercial-payments-interest-debt-recovery', part: 'when-a-payment-becomes-late', section: 'When a payment becomes late', heading: 'When a payment becomes late', topics: ['contracts'],
    fixture: 'If no payment date is agreed, payment is late 30 days after the customer receives the invoice or the goods or service, whichever is later. Businesses can agree longer payment terms, usually up to 60 days.' },
];

export const corpusUrl = (e: CorpusEntry) =>
  e.kind === 'legislation'
    ? `https://www.legislation.gov.uk/${e.path}/${e.unit}/${e.section}`
    : `https://www.gov.uk${e.path}/${e.part}`;

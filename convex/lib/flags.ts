/**
 * Flag rules and the citation guard (mvp2.md §6.2). Code, not AI: the model
 * proposes, these rules decide what needs a lawyer. Pure functions, unit tested.
 */

export type Flag = { code: FlagCode; reason: string; questionForLawyer: string };
export type FlagCode =
  | 'NEEDS_JUDGEMENT'
  | 'MISSING_FACTS'
  | 'DEADLINE_RISK'
  | 'HIGH_VALUE'
  | 'RESERVED_ACTIVITY'
  | 'DOC_REVIEW'
  | 'LOW_CONFIDENCE'
  | 'OUT_OF_SCOPE';

export const FLAG_LABELS: Record<FlagCode, string> = {
  NEEDS_JUDGEMENT: 'Needs legal judgement',
  MISSING_FACTS: 'Missing facts',
  DEADLINE_RISK: 'Deadline risk',
  HIGH_VALUE: 'High value',
  RESERVED_ACTIVITY: 'Reserved activity',
  DOC_REVIEW: 'Document review',
  LOW_CONFIDENCE: 'Low confidence',
  OUT_OF_SCOPE: 'Out of scope',
};

export const TOPICS = ['employment', 'contracts', 'data', 'ip', 'company', 'property', 'consumer', 'other'] as const;
export type Topic = (typeof TOPICS)[number];

export const HIGH_VALUE_PENCE = 10_000_00; // £10,000
export const MIN_CONFIDENCE = 0.7;

export type Triage = {
  topic: Topic;
  urgency: 'high' | 'standard';
  outOfScope: boolean;
  outOfScopeReason: string | null;
  valueAtStakePence: number | null;
  deadlineMentioned: boolean;
  reservedActivity: string | null; // litigation | conveyancing | probate
  sharesOrInvestment: boolean;
};

export type DraftAnswer = {
  answer: string;
  citations: { chunkId: string; act: string; section: string }[];
  needsJudgement: { reason: string; questionForLawyer: string }[];
  missingFacts: string[];
  confidence: number;
  nextStep: string;
};

export type FlagInput = {
  triage: Triage;
  /** null when Gemini failed twice: no answer is stored, a lawyer answers. */
  draft: DraftAnswer | null;
  citationsDropped: number;
  stage: 'idea' | 'trading' | 'raising';
  hasDocument: boolean;
};

export function flagRules({ triage, draft, citationsDropped, stage, hasDocument }: FlagInput): Flag[] {
  const flags: Flag[] = [];
  const add = (code: FlagCode, reason: string, questionForLawyer: string) => {
    if (!flags.some((f) => f.code === code)) flags.push({ code, reason, questionForLawyer });
  };

  if (draft?.needsJudgement.length) {
    add(
      'NEEDS_JUDGEMENT',
      draft.needsJudgement.map((j) => j.reason).join(' '),
      draft.needsJudgement.map((j) => j.questionForLawyer).join(' '),
    );
  }
  if (draft?.missingFacts.length) {
    add('MISSING_FACTS', `We don’t yet know: ${draft.missingFacts.join('; ')}.`, 'Which of these facts change the answer, and what should we ask the client?');
  }
  if (triage.deadlineMentioned) {
    add('DEADLINE_RISK', 'A deadline, tribunal, limitation period or court date was mentioned.', 'What is the deadline and how long does the client have to act?');
  }
  if ((triage.valueAtStakePence ?? 0) > HIGH_VALUE_PENCE || (stage === 'raising' && triage.sharesOrInvestment)) {
    add(
      'HIGH_VALUE',
      triage.sharesOrInvestment && stage === 'raising'
        ? 'The business is raising investment and this concerns shares or investment.'
        : 'More than £10,000 is at stake.',
      'Is the risk to the business proportionate to general information, or does this need formal advice?',
    );
  }
  if (triage.reservedActivity) {
    add(
      'RESERVED_ACTIVITY',
      `This may involve ${triage.reservedActivity}, which only an authorised law firm can carry out.`,
      'Confirm this should go to a partner firm and what to tell the client in the meantime.',
    );
  }
  if (hasDocument) {
    add('DOC_REVIEW', 'A contract or document is attached.', 'Review the highlighted clauses in the attached document.');
  }
  if (!draft) {
    add('LOW_CONFIDENCE', 'Remedy could not produce a reliable answer. A lawyer will answer this.', 'Please answer this question from scratch.');
  } else if (draft.confidence < MIN_CONFIDENCE || citationsDropped > 0) {
    add(
      'LOW_CONFIDENCE',
      citationsDropped > 0
        ? `${citationsDropped} citation(s) were removed because they did not match the legislation retrieved.`
        : 'The AI was not confident in this answer.',
      'Check the legal statements in the draft against the legislation.',
    );
  }
  if (triage.outOfScope) {
    add(
      'OUT_OF_SCOPE',
      triage.outOfScopeReason ?? 'This looks outside Remedy’s scope (criminal, immigration, family, or outside England and Wales).',
      'Should this be signposted elsewhere?',
    );
  }
  return flags;
}

/** Urgency after the rules: a deadline makes a matter high urgency. */
export const finalUrgency = (triage: Triage): 'high' | 'standard' =>
  triage.deadlineMentioned || triage.urgency === 'high' ? 'high' : 'standard';

export type ChunkRef = { _id: string; act: string; section: string; url: string };

/**
 * Citation guard: drops any citation whose chunkId was not retrieved and
 * rebuilds act, section and url from the stored chunk. Stops invented
 * citations reaching the client.
 */
export function guardCitations<Id extends string>(
  proposed: { chunkId: string }[],
  retrieved: (ChunkRef & { _id: Id })[],
) {
  const byId = new Map(retrieved.map((c) => [c._id as string, c]));
  const kept: { chunkId: Id; act: string; section: string; url: string }[] = [];
  let dropped = 0;
  for (const p of proposed) {
    const chunk = byId.get(p.chunkId);
    if (!chunk) {
      dropped++;
      continue;
    }
    if (kept.some((k) => k.chunkId === chunk._id)) continue;
    kept.push({ chunkId: chunk._id, act: chunk.act, section: chunk.section, url: chunk.url });
  }
  return { citations: kept, dropped };
}

/** Rough keyword triage, used when Gemini is unavailable. */
export function keywordTriage(question: string): Triage {
  const q = question.toLowerCase();
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  const topic: Topic = has('employ', 'freelanc', 'staff', 'hire', 'hiring', 'contractor', 'wage', 'dismiss', 'holiday', 'maternity')
    ? 'employment'
    : has('share', 'director', 'investor', 'equity', 'term sheet', 'company', 'shareholder', 'dividend')
      ? 'company'
      : has('gdpr', 'data', 'privacy', 'cookie', 'personal information')
        ? 'data'
        : has('copyright', 'trade mark', 'trademark', 'logo', 'brand', 'design right', 'ip ')
          ? 'ip'
          : has('lease', 'landlord', 'premises', 'tenant', 'office', 'shop unit')
            ? 'property'
            : has('refund', 'customer', 'consumer', 'faulty', 'return')
              ? 'consumer'
              : has('contract', 'invoice', 'paid', 'payment', 'supplier', 'terms', 'late pay')
                ? 'contracts'
                : 'other';
  const deadline = has('tribunal', 'court', 'deadline', 'claim form', 'limitation', 'acas');
  return {
    topic,
    urgency: deadline ? 'high' : 'standard',
    outOfScope: has('arrest', 'police', 'visa', 'immigration', 'divorce', 'custody', 'scotland', 'northern ireland'),
    outOfScopeReason: null,
    valueAtStakePence: null,
    deadlineMentioned: deadline,
    reservedActivity: has('sue', 'court', 'claim form') ? 'litigation' : has('buy the freehold', 'conveyanc') ? 'conveyancing' : null,
    sharesOrInvestment: has('share', 'investor', 'equity', 'term sheet', 'investment', 'round'),
  };
}

const shortAct = (act: string) =>
  act.startsWith('GOV.UK: ') ? `GOV.UK ${act.slice(8)}` : act.replace(/\s*\(Interest\)/, '').replace(/^Copyright, Designs and Patents Act/, 'CDPA');

/** "Employment Rights Act 1996, s.230", "UK GDPR, Art.6", "GOV.UK Employment status: Worker". */
export const citationLabel = (c: { act: string; section: string }) =>
  c.act.startsWith('GOV.UK') ? `${shortAct(c.act)}: ${c.section}` : `${shortAct(c.act)}, ${c.act === 'UK GDPR' ? 'Art.' : 's.'}${c.section}`;

/**
 * The model marks statements with [chunkId]. Replace verified ids with a
 * readable label and drop unverified ones, so no raw ids or invented
 * references reach the client.
 */
export function renderCitationMarkers(answer: string, citations: { chunkId: string; act: string; section: string }[]) {
  const byId = new Map(citations.map((c) => [c.chunkId, citationLabel(c)]));
  return answer
    .replace(/\[([a-z0-9]{20,})\](?:\s*,\s*\[([a-z0-9]{20,})\])*/g, (group) => {
      const labels = [...new Set([...group.matchAll(/\[([a-z0-9]{20,})\]/g)].map((m) => byId.get(m[1])).filter(Boolean))];
      return labels.length ? `(${labels.join('; ')})` : '';
    })
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

import { ConvexError, v, type Infer } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { action, internalMutation, internalQuery, mutation, query, type ActionCtx, type MutationCtx, type QueryCtx } from './_generated/server';
import { audit, requireBusiness, requireClient } from './lib/auth';
import {
  BLANK,
  SKIP,
  activeFields,
  displayValue,
  fallbackParse,
  isDone,
  missingFields,
  normalise,
  suggestionsFor,
  type Answers,
  type Field,
} from './lib/drafting/fields';
import { toPlainText } from './lib/drafting/model';
import { renderPdf } from './lib/drafting/pdf';
import { draftMessage } from './lib/drafting/schema';
import { OUT_OF_SCOPE, helpers, templateById, templatesFor, type Product, type Template } from './lib/drafting/templates';
import { FAST_MODEL, SMART_MODEL, clientText, geminiJson, obj, str } from './lib/gemini';

/**
 * Legal drafting in chat (both products). The AI works out which document
 * is wanted, pulls answers out of what the person says and tidies their own
 * words. The legal text comes only from the fixed templates in
 * lib/drafting/templates.ts, and every answer is validated in code.
 */

const ownerKind = v.union(v.literal('client'), v.literal('business'));
type OwnerKind = Infer<typeof ownerKind>;

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', ur: 'Urdu', pl: 'Polish', ar: 'Arabic', ro: 'Romanian', ku: 'Kurdish (Sorani)', pa: 'Punjabi' };

const SYSTEM = `You help people in England and Wales prepare legal letters and simple agreements from fixed, lawyer-reviewed templates.
You never write legal argument or give legal advice. You only collect the facts the template needs, accurately, and tidy the person's own words.`;

export const draftRef = (id: string) => `D-${id.slice(-6).toUpperCase()}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

type Ctx = QueryCtx | MutationCtx;

async function resolveOwner(ctx: Ctx, kind: OwnerKind, token: string) {
  if (kind === 'client') {
    const c = await requireClient(ctx, token);
    return { product: 'cc' as Product, clientId: c._id, businessId: undefined, language: c.language, business: null };
  }
  const b = await requireBusiness(ctx, token);
  return { product: 'remedy' as Product, clientId: undefined, businessId: b._id, language: 'en', business: b };
}

async function requireDraft(ctx: Ctx, kind: OwnerKind, token: string, draftId: Id<'drafts'>) {
  const owner = await resolveOwner(ctx, kind, token);
  const draft = await ctx.db.get(draftId);
  const mine = draft && (kind === 'client' ? draft.clientId === owner.clientId : draft.businessId === owner.businessId);
  if (!draft || !mine) throw new ConvexError('We couldn’t find that document.');
  const template = templateById(draft.templateId);
  if (!template) throw new ConvexError('This kind of document is no longer available.');
  return { owner, draft, template };
}

// ---------------------------------------------------------------------------
// Shared turn logic
// ---------------------------------------------------------------------------

function nextFieldFor(template: Template, answers: Answers, today: string) {
  const f = missingFields(template.fields, answers, today)[0];
  return f ? { field: f, next: { key: f.key, text: f.question, suggestions: suggestionsFor(f) } } : null;
}

function describeFields(template: Template, answers: Answers, today: string) {
  return activeFields(template.fields, answers, today)
    .map((f) => {
      const kind =
        f.kind === 'choice'
          ? `one of ${JSON.stringify((f.options ?? []).map((o) => o.id))} (${(f.options ?? []).map((o) => `${o.id} = ${o.label}`).join('; ')})`
          : f.kind === 'yesno'
            ? '"yes" or "no"'
            : f.kind === 'date'
              ? 'date as YYYY-MM-DD'
              : f.kind === 'money'
                ? 'amount in pounds, e.g. "£4,000.00"'
                : f.kind === 'number'
                  ? 'whole number'
                  : f.kind === 'percent'
                    ? 'percentage number, e.g. "4.25"'
                    : f.kind === 'address'
                      ? 'postal address, lines separated by \\n'
                      : 'text';
      return `- ${f.key}: ${f.label} — ${kind}${isDone(answers[f.key]) ? ' [ALREADY ANSWERED]' : ''}`;
    })
    .join('\n');
}

/** Extracts answers from one message. Throws if the AI fails, so the caller can fall back. */
async function extractAnswers(template: Template, answers: Answers, currentKey: string | undefined, text: string, today: string) {
  const { data } = await geminiJson({
    model: FAST_MODEL,
    timeoutMs: 15000,
    system: SYSTEM,
    prompt: `Document: ${template.title}. Today is ${today}.
Fields:
${describeFields(template, answers, today)}
${currentKey ? `The person is answering the question for field "${currentKey}".` : 'This is the person’s first message about the document.'}

Their message:
${clientText(text)}

Return JSON {"answers": {fieldKey: value}, "skip": [fieldKeys]}.
- Include only fields the message clearly answers. Values must be in English even if the message is not.
- Do not change fields marked ALREADY ANSWERED unless the person is clearly correcting them.
- Put a field in "skip" only if the person says to skip it, leave it blank, or that they don't know it.
- Relative dates ("last Tuesday", "a week ago") become YYYY-MM-DD using today's date.
- For free-text fields, keep the person's own words; do not add anything.
- Be careful with negatives: "doesn't mention", "no", "never" and "not" mean the opposite of the field. If unsure, leave the field out.`,
    parse: (raw) => {
      const o = obj(raw);
      const ans = o.answers && typeof o.answers === 'object' && !Array.isArray(o.answers) ? (o.answers as Record<string, unknown>) : {};
      const skip = Array.isArray(o.skip) ? o.skip.filter((k): k is string => typeof k === 'string') : [];
      return { ans, skip };
    },
  });
  return data;
}

/** Validates and merges answers. Returns the new answers and which keys changed. */
function mergeAnswers(template: Template, answers: Answers, incoming: Record<string, unknown>, skip: string[], today: string, currentKey?: string | null) {
  const next = { ...answers };
  const changed: string[] = [];
  for (const f of template.fields) {
    // Consequential answers only count when the person was asked that question.
    if (f.askDirectly && currentKey !== f.key && currentKey !== null) continue;
    let value: string | null = null;
    if (f.key in incoming) value = normalise(f, incoming[f.key], today);
    if (value === null && skip.includes(f.key)) value = f.placeholderOk ? BLANK : f.required === false ? SKIP : null;
    if (value !== null && value !== next[f.key]) {
      next[f.key] = value;
      changed.push(f.key);
    }
  }
  return { answers: next, changed };
}

async function translate(texts: string[], language: string) {
  if (language === 'en' || !texts.length) return texts;
  try {
    const { data } = await geminiJson({
      model: FAST_MODEL,
      timeoutMs: 10000,
      system: SYSTEM,
      prompt: `Translate each string into ${LANGUAGE_NAMES[language] ?? 'English'}, keeping it short and friendly. Return JSON {"t": string[]} in the same order.\n${JSON.stringify(texts)}`,
      parse: (raw) => {
        const t = obj(raw).t;
        if (!Array.isArray(t) || t.length !== texts.length) throw new Error('bad translation');
        return t.map((x, i) => (typeof x === 'string' && x.trim() ? x.trim() : texts[i]));
      },
    });
    return data;
  } catch {
    return texts;
  }
}

type Advance = {
  answers: Answers;
  nextField?: { key: string; text: string; suggestions: string[] };
  status: 'collecting' | 'ready';
  assistantText: string;
  warnings: string[];
};

async function advance(template: Template, answers: Answers, today: string, language: string, lead: string): Promise<Advance> {
  const next = nextFieldFor(template, answers, today);
  const warnings = template.warnings?.(answers, today) ?? [];
  if (!next) {
    const [msg] = await translate([`${lead} That’s everything I need. Check your answers, then create the document.`.trim()], language);
    return { answers, status: 'ready', assistantText: msg, warnings };
  }
  const hint = next.field.hint ? ` ${next.field.hint}` : '';
  const [msg, ...suggestions] = await translate([`${lead} ${next.next.text}${hint}`.trim(), ...next.next.suggestions], language);
  return { answers, status: 'collecting', nextField: { ...next.next, text: next.next.text, suggestions }, assistantText: msg, warnings };
}

// ---------------------------------------------------------------------------
// Choosing a template
// ---------------------------------------------------------------------------

type Classification =
  | { kind: 'template'; template: Template }
  | { kind: 'unsupported'; message: string }
  | { kind: 'unclear'; message: string };

async function classify(text: string, product: Product): Promise<Classification> {
  const blocked = OUT_OF_SCOPE.find((o) => o.match.test(text));
  if (blocked) {
    return { kind: 'unsupported', message: `I can’t draft ${blocked.what}. ${product === 'cc' ? blocked.cc : blocked.remedy}` };
  }
  const options = templatesFor(product);
  try {
    const { data } = await geminiJson({
      model: FAST_MODEL,
      timeoutMs: 10000,
      system: SYSTEM,
      prompt: `Which document does this person want? Choose from:
${options.map((t) => `- ${t.id}: ${t.title}. ${t.description}`).join('\n')}

Message:
${clientText(text)}

Return JSON {"templateId": string or null}. Use null if none clearly fits.`,
      parse: (raw) => {
        const id = obj(raw).templateId;
        return typeof id === 'string' ? id : null;
      },
    });
    const t = data ? options.find((o) => o.id === data) : undefined;
    if (t) return { kind: 'template', template: t };
  } catch {
    // Fall back to keywords below.
  }
  const byKeyword = options.filter((t) => t.keywords.test(text));
  if (byKeyword.length === 1) return { kind: 'template', template: byKeyword[0] };
  return {
    kind: 'unclear',
    message: `I can draft these: ${options.map((t) => t.title.toLowerCase()).join(', ')}. Which one do you need?`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const templates = query({
  args: { kind: ownerKind },
  handler: async (_ctx, { kind }) =>
    templatesFor(kind === 'client' ? 'cc' : 'remedy').map((t) => ({ id: t.id, title: t.title, short: t.short, kind: t.kind })),
});

type StartResult =
  | { status: 'started'; draftId: Id<'drafts'>; title: string }
  | { status: 'unsupported'; message: string }
  | { status: 'unclear'; message: string; options: { id: string; title: string }[] };

/** Starts a draft from a free-text request or a chosen template. */
export const start = action({
  args: {
    kind: ownerKind,
    token: v.string(),
    text: v.optional(v.string()),
    templateId: v.optional(v.string()),
    caseId: v.optional(v.id('cases')),
    matterId: v.optional(v.id('matters')),
  },
  handler: async (ctx, args): Promise<StartResult> => {
    const owner = await ctx.runQuery(internal.drafting.ownerContext, { kind: args.kind, token: args.token, caseId: args.caseId });
    const text = (args.text ?? '').trim().slice(0, 2000);
    const result = await startDraft(ctx, { ...args, text, owner });
    return result;
  },
});

type OwnerContext = {
  product: Product;
  language: string;
  clientId?: Id<'clients'>;
  businessId?: Id<'businesses'>;
  caseId?: Id<'cases'>;
  facts?: Doc<'cases'>['facts'];
  business?: { name: string; companyNumber?: string };
};

async function startDraft(
  ctx: ActionCtx,
  args: { kind: OwnerKind; token: string; text: string; templateId?: string; matterId?: Id<'matters'>; owner: OwnerContext },
): Promise<StartResult> {
  const { owner, text } = args;
  let template: Template | undefined;
  if (args.templateId) {
    template = templateById(args.templateId);
    if (!template || template.product !== owner.product) throw new ConvexError('That document isn’t available here.');
  } else {
    if (!text) throw new ConvexError('Tell us what you’d like drafted.');
    const c = await classify(text, owner.product);
    if (c.kind === 'unsupported') return { status: 'unsupported', message: c.message };
    if (c.kind === 'unclear') {
      return { status: 'unclear', message: c.message, options: templatesFor(owner.product).map((t) => ({ id: t.id, title: t.title })) };
    }
    template = c.template;
  }

  const today = todayIso();
  let answers: Answers = {};
  const pre = template.prefill?.({ facts: owner.facts, business: owner.business }) ?? {};
  ({ answers } = mergeAnswers(template, answers, pre, [], today, null));

  // Their first message may already answer some questions.
  let got = 0;
  if (text && !args.templateId) {
    try {
      const { ans, skip } = await extractAnswers(template, answers, undefined, text, today);
      const merged = mergeAnswers(template, answers, ans, skip, today, undefined);
      answers = merged.answers;
      got = merged.changed.length;
    } catch {
      // Ask everything instead.
    }
  }

  const prefilled = Object.keys(pre).length;
  const intro = `I can help you write a ${template.title.toLowerCase()}. I’ll ask a few short questions${prefilled || got ? ', and I’ve filled in what I already know' : ''}.`;
  const step = await advance(template, answers, today, owner.language, intro);

  const draftId: Id<'drafts'> = await ctx.runMutation(internal.drafting.create, {
    clientId: owner.clientId,
    caseId: owner.caseId,
    businessId: owner.businessId,
    matterId: args.matterId,
    templateId: template.id,
    clientText: text || undefined,
    step: { ...step, today },
  });
  return { status: 'started', draftId, title: template.title };
}

/** One chat message while collecting answers. */
export const send = action({
  args: { kind: ownerKind, token: v.string(), draftId: v.id('drafts'), text: v.string() },
  handler: async (ctx, { kind, token, draftId, text }): Promise<{ status: string }> => {
    const { draft, language } = await ctx.runQuery(internal.drafting.loadDraft, { kind, token, draftId });
    const template = templateById(draft.templateId)!;
    const said = text.trim().slice(0, 2500);
    if (!said) throw new ConvexError('Type a reply first.');
    const today = todayIso();
    const current = draft.nextField ? template.fields.find((f) => f.key === draft.nextField!.key) : undefined;

    let answers = draft.answers;
    let changed: string[] = [];
    try {
      const { ans, skip } = await extractAnswers(template, answers, current?.key, said, today);
      ({ answers, changed } = mergeAnswers(template, answers, ans, skip, today, current?.key));
    } catch (err) {
      console.warn('draft extraction failed, using fallback', err);
    }
    // If the current question still isn't answered, read the reply directly.
    if (current && !changed.includes(current.key) && (changed.length === 0 || !['text', 'longtext', 'name', 'address'].includes(current.kind))) {
      const value = fallbackParse(current, said, today);
      if (value !== null) {
        answers = { ...answers, [current.key]: value };
        changed.push(current.key);
      }
    }

    const lead = changed.length ? (changed.length > 1 ? 'Thanks, I’ve noted that.' : 'Got it.') : 'Sorry, I didn’t catch that.';
    const step = await advance(template, answers, today, language, lead);
    await ctx.runMutation(internal.drafting.saveTurn, { draftId, clientText: said, changed, step: { ...step, today } });
    return { status: step.status };
  },
});

/** Direct edit of one answer from the answers panel. */
export const setAnswer = mutation({
  args: { kind: ownerKind, token: v.string(), draftId: v.id('drafts'), key: v.string(), value: v.string() },
  handler: async (ctx, { kind, token, draftId, key, value }) => {
    const { draft, template } = await requireDraft(ctx, kind, token, draftId);
    const field = template.fields.find((f) => f.key === key);
    if (!field) throw new ConvexError('Unknown question.');
    const today = todayIso();
    const v2 = value.trim() === '' ? (field.placeholderOk ? BLANK : field.required === false ? SKIP : null) : normalise(field, value, today);
    if (v2 === null) throw new ConvexError(`That doesn’t look right for “${field.label}”.`);
    const answers = { ...draft.answers, [key]: v2 };
    const tidied = { ...draft.tidied };
    delete tidied[key];
    const next = nextFieldFor(template, answers, today);
    await ctx.db.patch(draftId, {
      answers,
      tidied,
      nextField: next?.next,
      status: next ? 'collecting' : 'ready',
      warnings: template.warnings?.(answers, today) ?? [],
      today,
      updatedAt: Date.now(),
    });
  },
});

/** Renders the document and attaches the PDF to the chat. */
export const generate = action({
  args: { kind: ownerKind, token: v.string(), draftId: v.id('drafts') },
  handler: async (ctx, { kind, token, draftId }): Promise<{ version: number }> => {
    const { draft } = await ctx.runQuery(internal.drafting.loadDraft, { kind, token, draftId });
    const template = templateById(draft.templateId)!;
    const today = todayIso();
    const missing = missingFields(template.fields, draft.answers, today);
    if (missing.length) throw new ConvexError(`Please answer: ${missing.map((f) => f.label).join(', ')}.`);

    // Tidy free-text answers that haven't been tidied since they last changed.
    const tidied = { ...draft.tidied };
    const toTidy = activeFields(template.fields, draft.answers, today).filter(
      (f) => f.tidy && isDone(draft.answers[f.key]) && draft.answers[f.key] !== BLANK && draft.answers[f.key] !== SKIP && !tidied[f.key],
    );
    if (toTidy.length) {
      try {
        const { data } = await geminiJson({
          model: SMART_MODEL,
          timeoutMs: 25000,
          system: SYSTEM,
          prompt: `These are a person's own words for a ${template.title.toLowerCase()}. Rewrite each as clear, polite, formal ${template.kind === 'agreement' ? 'contract wording' : 'first-person British English for a letter'}.
Rules: keep every fact, add no new facts, names, dates or amounts, make no legal arguments and cite no law, translate into English if needed, and keep it about the same length. Return JSON {"tidied": {fieldKey: string}}.
${toTidy.map((f) => `${f.key} (${f.label}):\n${clientText(draft.answers[f.key])}`).join('\n\n')}`,
          parse: (raw) => {
            const t = obj(raw).tidied;
            if (!t || typeof t !== 'object') throw new Error('bad tidy');
            const out: Record<string, string> = {};
            for (const f of toTidy) {
              const s = str((t as Record<string, unknown>)[f.key], 4000);
              if (s) out[f.key] = s;
            }
            return out;
          },
        });
        Object.assign(tidied, data);
      } catch (err) {
        console.warn('tidy failed, using the person’s own words', err);
      }
    }

    const merged = { ...draft.answers, ...tidied };
    const model = template.render(merged, helpers(merged, template.fields, today));
    const reference = draftRef(draftId);
    const brand = 'Remedy';
    const { bytes, pages } = await renderPdf(model, { reference, brand });
    const storageId = await ctx.storage.store(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const version: number = await ctx.runMutation(internal.drafting.saveGenerated, { draftId, storageId, pages, tidied, today });
    return { version };
  },
});

export const get = query({
  args: { kind: ownerKind, token: v.string(), draftId: v.id('drafts') },
  handler: async (ctx, { kind, token, draftId }) => {
    const { draft, template } = await requireDraft(ctx, kind, token, draftId);
    return await draftView(ctx, draft, template);
  },
});

export const mine = query({
  args: { kind: ownerKind, token: v.string() },
  handler: async (ctx, { kind, token }) => {
    const owner = await resolveOwner(ctx, kind, token);
    const rows =
      kind === 'client'
        ? await ctx.db.query('drafts').withIndex('by_clientId', (q) => q.eq('clientId', owner.clientId)).order('desc').take(30)
        : await ctx.db.query('drafts').withIndex('by_businessId', (q) => q.eq('businessId', owner.businessId)).order('desc').take(30);
    return rows.map((d) => ({
      _id: d._id,
      ref: draftRef(d._id),
      title: templateById(d.templateId)?.title ?? 'Document',
      status: d.status,
      version: d.version,
      updatedAt: d.updatedAt,
    }));
  },
});

export const remove = mutation({
  args: { kind: ownerKind, token: v.string(), draftId: v.id('drafts') },
  handler: async (ctx, { kind, token, draftId }) => {
    const { draft } = await requireDraft(ctx, kind, token, draftId);
    await deleteDraft(ctx, draft);
  },
});

// ---------------------------------------------------------------------------
// Views and helpers
// ---------------------------------------------------------------------------

async function draftView(ctx: QueryCtx, draft: Doc<'drafts'>, template: Template) {
  const today = draft.today;
  const fields = activeFields(template.fields, draft.answers, today);
  const missing = missingFields(template.fields, draft.answers, today);
  const merged = { ...draft.answers, ...draft.tidied };
  const preview = missing.length ? null : toPlainText(template.render(merged, helpers(merged, template.fields, today)));
  return {
    _id: draft._id,
    ref: draftRef(draft._id),
    templateId: template.id,
    title: template.title,
    docKind: template.kind,
    product: template.product,
    status: draft.status,
    version: draft.version,
    caseId: draft.caseId,
    nextField: draft.nextField,
    warnings: draft.warnings,
    nextSteps: template.nextSteps(draft.answers),
    fields: fields.map((f) => ({
      key: f.key,
      label: f.label,
      kind: f.kind,
      options: f.options,
      required: f.required !== false,
      placeholderOk: !!f.placeholderOk,
      raw: draft.answers[f.key] ?? '',
      display: displayValue(f, draft.answers[f.key]),
      done: isDone(draft.answers[f.key]),
    })),
    missing: missing.map((f) => f.key),
    preview,
    pdfUrl: draft.pdfStorageId ? await ctx.storage.getUrl(draft.pdfStorageId) : null,
    transcript: await Promise.all(
      draft.transcript.map(async (m) => ({ ...m, pdfUrl: m.pdf ? await ctx.storage.getUrl(m.pdf.storageId) : null })),
    ),
    updatedAt: draft.updatedAt,
  };
}

export async function deleteDraft(ctx: MutationCtx, draft: Doc<'drafts'>) {
  const ids = new Set(draft.transcript.flatMap((m) => (m.pdf ? [m.pdf.storageId] : [])));
  if (draft.pdfStorageId) ids.add(draft.pdfStorageId);
  for (const id of ids) await ctx.storage.delete(id).catch(() => {});
  await ctx.db.delete(draft._id);
}

/** For "delete my data". */
export async function deleteDraftsFor(ctx: MutationCtx, owner: { clientId?: Id<'clients'>; businessId?: Id<'businesses'> }) {
  const rows = owner.clientId
    ? await ctx.db.query('drafts').withIndex('by_clientId', (q) => q.eq('clientId', owner.clientId)).take(200)
    : owner.businessId
      ? await ctx.db.query('drafts').withIndex('by_businessId', (q) => q.eq('businessId', owner.businessId)).take(200)
      : [];
  for (const d of rows) await deleteDraft(ctx, d);
}

/** Drafts linked to a case, for the adviser view. */
export async function draftsForCase(ctx: QueryCtx, caseId: Id<'cases'>) {
  const rows = await ctx.db.query('drafts').withIndex('by_caseId', (q) => q.eq('caseId', caseId)).take(20);
  return await Promise.all(
    rows.map(async (d) => ({
      _id: d._id,
      ref: draftRef(d._id),
      title: templateById(d.templateId)?.title ?? 'Document',
      status: d.status,
      version: d.version,
      pdfUrl: d.pdfStorageId ? await ctx.storage.getUrl(d.pdfStorageId) : null,
      updatedAt: d.updatedAt,
    })),
  );
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

export const ownerContext = internalQuery({
  args: { kind: ownerKind, token: v.string(), caseId: v.optional(v.id('cases')) },
  handler: async (ctx, { kind, token, caseId }): Promise<OwnerContext> => {
    const owner = await resolveOwner(ctx, kind, token);
    let facts: Doc<'cases'>['facts'] | undefined;
    if (caseId && owner.clientId) {
      const c = await ctx.db.get(caseId);
      if (!c || c.clientId !== owner.clientId) throw new ConvexError('We couldn’t find that case.');
      facts = c.facts;
    }
    return {
      product: owner.product,
      language: owner.language,
      clientId: owner.clientId,
      businessId: owner.businessId,
      caseId: facts ? caseId : undefined,
      facts,
      business: owner.business ? { name: owner.business.name, companyNumber: owner.business.companyNumber } : undefined,
    };
  },
});

export const loadDraft = internalQuery({
  args: { kind: ownerKind, token: v.string(), draftId: v.id('drafts') },
  handler: async (ctx, { kind, token, draftId }) => {
    const { draft, owner } = await requireDraft(ctx, kind, token, draftId);
    return { draft, language: owner.language };
  },
});

const stepValidator = v.object({
  answers: v.record(v.string(), v.string()),
  nextField: v.optional(v.object({ key: v.string(), text: v.string(), suggestions: v.array(v.string()) })),
  status: v.union(v.literal('collecting'), v.literal('ready')),
  assistantText: v.string(),
  warnings: v.array(v.string()),
  today: v.string(),
});

export const create = internalMutation({
  args: {
    clientId: v.optional(v.id('clients')),
    caseId: v.optional(v.id('cases')),
    businessId: v.optional(v.id('businesses')),
    matterId: v.optional(v.id('matters')),
    templateId: v.string(),
    clientText: v.optional(v.string()),
    step: stepValidator,
  },
  handler: async (ctx, { step, clientText, ...owner }) => {
    const now = Date.now();
    const transcript: Infer<typeof draftMessage>[] = [];
    if (clientText) transcript.push({ role: 'client', text: clientText, at: now });
    transcript.push({ role: 'assistant', text: step.assistantText, at: now });
    const draftId = await ctx.db.insert('drafts', {
      ...owner,
      status: step.status,
      answers: step.answers,
      tidied: {},
      transcript,
      nextField: step.nextField,
      warnings: step.warnings,
      today: step.today,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, { caseId: owner.caseId, matterId: owner.matterId, actor: owner.businessId ? 'business' : 'client', event: 'draft_started', detail: { draftId, templateId: owner.templateId } });
    return draftId;
  },
});

export const saveTurn = internalMutation({
  args: { draftId: v.id('drafts'), clientText: v.string(), changed: v.array(v.string()), step: stepValidator },
  handler: async (ctx, { draftId, clientText, changed, step }) => {
    const d = await ctx.db.get(draftId);
    if (!d) return;
    const now = Date.now();
    const tidied = { ...d.tidied };
    for (const k of changed) delete tidied[k];
    await ctx.db.patch(draftId, {
      answers: step.answers,
      tidied,
      transcript: [...d.transcript, { role: 'client' as const, text: clientText, at: now }, { role: 'assistant' as const, text: step.assistantText, at: now }].slice(-80),
      nextField: step.nextField,
      // A generated document that hasn't changed stays generated.
      status: d.status === 'generated' && changed.length === 0 && step.status === 'ready' ? 'generated' : step.status,
      warnings: step.warnings,
      today: step.today,
      updatedAt: now,
    });
  },
});

export const saveGenerated = internalMutation({
  args: { draftId: v.id('drafts'), storageId: v.id('_storage'), pages: v.number(), tidied: v.record(v.string(), v.string()), today: v.string() },
  handler: async (ctx, { draftId, storageId, pages, tidied, today }): Promise<number> => {
    const d = await ctx.db.get(draftId);
    if (!d) return 0;
    const version = d.version + 1;
    const template = templateById(d.templateId);
    const now = Date.now();
    await ctx.db.patch(draftId, {
      status: 'generated',
      tidied,
      version,
      pdfStorageId: storageId,
      today,
      nextField: undefined,
      transcript: [
        ...d.transcript,
        {
          role: 'assistant' as const,
          text:
            version === 1
              ? `Here’s your ${template?.title.toLowerCase() ?? 'document'}. Read it carefully, fill in anything marked with a line, and check it’s right before you send or sign it.`
              : `Here’s version ${version}, with your changes.`,
          at: now,
          pdf: { storageId, version, pages },
        },
      ].slice(-80),
      updatedAt: now,
    });
    await audit(ctx, { caseId: d.caseId, matterId: d.matterId, actor: 'ai:drafting.generate', event: 'draft_generated', detail: { draftId, version, templateId: d.templateId } });
    return version;
  },
});

/** Adds a message to a Remedy case chat (used when the intake spots a drafting request). */
export const noteInCase = internalMutation({
  args: { caseId: v.id('cases'), clientText: v.string(), assistantText: v.string(), draftId: v.optional(v.id('drafts')) },
  handler: async (ctx, { caseId, clientText, assistantText, draftId }) => {
    const c = await ctx.db.get(caseId);
    if (!c) return;
    const now = Date.now();
    await ctx.db.patch(caseId, {
      transcript: [...c.transcript, { role: 'client' as const, text: clientText, at: now }, { role: 'assistant' as const, text: assistantText, at: now, draftId }].slice(-40),
      updatedAt: now,
    });
  },
});

export { startDraft, type OwnerContext, type StartResult };
export type DraftView = Awaited<ReturnType<typeof draftView>>;
export type FieldDef = Field;

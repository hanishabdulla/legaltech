/**
 * Drafting fields: what a template asks for, and deterministic validation of
 * every answer (from the AI or typed directly) before it is stored.
 */

export type FieldKind = 'name' | 'text' | 'longtext' | 'address' | 'date' | 'money' | 'number' | 'percent' | 'choice' | 'yesno';

export type Answers = Record<string, string>;

/** Stored for a field the person wants to fill in by hand on the printed document. */
export const BLANK = '__blank__';
/** Stored for an optional field the person skipped. */
export const SKIP = '__skip__';

export type Field = {
  key: string;
  label: string;
  question: string;
  kind: FieldKind;
  /** Defaults to true. */
  required?: boolean;
  /** Required, but the person may leave it blank to write in by hand (e.g. NI number). */
  placeholderOk?: boolean;
  options?: { id: string; label: string }[];
  suggestions?: string[];
  hint?: string;
  min?: number;
  max?: number;
  /**
   * Legally consequential: only accept an answer given to this question
   * directly, never one the AI inferred from other text.
   */
  askDirectly?: boolean;
  /** Rewrite the person's words into clear, formal first-person English before use. */
  tidy?: boolean;
  /** Only ask when this returns true. `today` is YYYY-MM-DD. */
  when?: (a: Answers, today: string) => boolean;
};

export const isDone = (v: string | undefined) => v !== undefined && v !== '';

export function activeFields(fields: Field[], a: Answers, today: string) {
  return fields.filter((f) => (f.when ? f.when(a, today) : true));
}

export function missingFields(fields: Field[], a: Answers, today: string) {
  return activeFields(fields, a, today).filter((f) => !isDone(a[f.key]));
}

const MAX: Record<FieldKind, number> = {
  name: 120,
  text: 300,
  longtext: 2500,
  address: 300,
  date: 10,
  money: 20,
  number: 10,
  percent: 10,
  choice: 40,
  yesno: 3,
};

function parsePence(raw: string): number | null {
  // Always pounds: "4000", "£4,000", "4k", "£12.50".
  const s = raw.toLowerCase().replace(/[,£\s]/g, '');
  const m = /^(\d+(?:\.\d{1,2})?)(k)?$/.exec(s.replace(/(pounds?|gbp)$/, ''));
  if (!m) return null;
  let pounds = Number(m[1]);
  if (m[2]) pounds *= 1000;
  if (!Number.isFinite(pounds) || pounds < 0) return null;
  return Math.round(pounds * 100);
}

function parseDate(raw: string, today: string): string | null {
  const s = raw.trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return validIso(s);
  if (s === 'today') return today;
  if (s === 'yesterday') return shiftDays(today, -1);
  const dmy = /^(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})$/.exec(s);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return validIso(`${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
  }
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const named = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s*(\d{4})?$/.exec(s);
  if (named) {
    const mi = months.findIndex((m) => named[2].startsWith(m));
    if (mi >= 0) {
      const y = named[3] ?? today.slice(0, 4);
      return validIso(`${y}-${String(mi + 1).padStart(2, '0')}-${named[1].padStart(2, '0')}`);
    }
  }
  return null;
}

function validIso(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function shiftDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** Adds calendar months, clamping to the month's last day (e.g. 31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Validates one answer. Returns the stored string, or null if it isn't valid for the field. */
export function normalise(field: Field, raw: unknown, today: string): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'boolean' && field.kind === 'yesno') return raw ? 'yes' : 'no';
  if (typeof raw === 'number') raw = String(raw);
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  if (s === BLANK) return field.placeholderOk ? BLANK : null;
  if (s === SKIP) return field.required === false ? SKIP : null;

  switch (field.kind) {
    case 'name':
    case 'text':
    case 'longtext':
      return s.slice(0, MAX[field.kind]);
    case 'address':
      return s
        .split(/\n|,(?=\s*\S)/)
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n')
        .slice(0, MAX.address);
    case 'date':
      return parseDate(s, today);
    case 'money': {
      const p = parsePence(s);
      return p === null ? null : String(p);
    }
    case 'number': {
      const n = Number(s.replace(/[^\d.-]/g, ''));
      if (!Number.isFinite(n)) return null;
      const r = Math.round(n);
      if (field.min !== undefined && r < field.min) return null;
      if (field.max !== undefined && r > field.max) return null;
      return String(r);
    }
    case 'percent': {
      const n = Number(s.replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && n >= 0 && n <= 25 ? String(Math.round(n * 100) / 100) : null;
    }
    case 'choice': {
      const opts = field.options ?? [];
      const byId = opts.find((o) => o.id === s);
      if (byId) return byId.id;
      const lower = s.toLowerCase();
      const byLabel = opts.find((o) => o.label.toLowerCase() === lower) ?? opts.find((o) => lower.includes(o.label.toLowerCase()) || o.label.toLowerCase().includes(lower));
      return byLabel?.id ?? null;
    }
    case 'yesno': {
      if (/^(y|yes|yeah|yep|true|correct|please|ok)\b/i.test(s)) return 'yes';
      if (/^(n|no|nope|false|not)\b/i.test(s)) return 'no';
      return null;
    }
  }
}

/** Deterministic reading of a reply to the current question (used when the AI is unavailable). */
export function fallbackParse(field: Field, text: string, today: string): string | null {
  const s = text.trim();
  if (/^(skip|leave (it )?blank|i don'?t know|not sure|n\/a|none)$/i.test(s)) {
    if (field.placeholderOk) return BLANK;
    if (field.required === false) return SKIP;
  }
  return normalise(field, s, today);
}

/** Human-readable value for chips and summaries. */
export function displayValue(field: Field, value: string | undefined) {
  if (!isDone(value)) return '';
  if (value === BLANK) return 'Fill in by hand';
  if (value === SKIP) return 'Skipped';
  switch (field.kind) {
    case 'money':
      return formatPence(Number(value));
    case 'date':
      return formatDate(value!);
    case 'choice':
      return field.options?.find((o) => o.id === value)?.label ?? value!;
    case 'yesno':
      return value === 'yes' ? 'Yes' : 'No';
    case 'percent':
      return `${value}%`;
    case 'address':
      return value!.replace(/\n/g, ', ');
    default:
      return value!;
  }
}

export const formatPence = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Suggestions shown as tap-to-answer chips for a field. */
export function suggestionsFor(field: Field) {
  const base = field.suggestions ?? (field.kind === 'choice' ? (field.options ?? []).map((o) => o.label) : field.kind === 'yesno' ? ['Yes', 'No'] : []);
  const extra = field.placeholderOk ? ['Leave blank'] : field.required === false ? ['Skip'] : [];
  return [...base, ...extra].slice(0, 6);
}

/**
 * A drafted document, independent of output format. Rendered to PDF by
 * pdf.ts and previewed as text in the apps.
 */
export type Block =
  | { t: 'h'; text: string }
  | { t: 'p'; text: string; bold?: boolean; italic?: boolean }
  | { t: 'list'; items: string[] }
  | { t: 'clause'; num: string; title?: string; text?: string; subs?: string[] };

export type Signature = { label: string; lines: string[] };

export type DocModel = {
  title: string;
  kind: 'letter' | 'agreement';
  /** Letters: the sender's name and address, top right. */
  sender?: string[];
  /** Letters: the recipient, top left. */
  recipient?: string[];
  date: string;
  /** Letters: reference lines under the date (account numbers etc.). */
  refs?: string[];
  subject?: string;
  salutation?: string;
  blocks: Block[];
  closing?: string;
  signatures: Signature[];
};

/** Plain-text version for previews, copying and sharing. */
export function toPlainText(d: DocModel) {
  const out: string[] = [];
  if (d.kind === 'agreement') out.push(d.title.toUpperCase(), '');
  if (d.sender?.length) out.push(...d.sender, '');
  if (d.recipient?.length) out.push(...d.recipient, '');
  out.push(d.date);
  if (d.refs?.length) out.push(...d.refs);
  out.push('');
  if (d.salutation) out.push(d.salutation, '');
  if (d.subject) out.push(d.subject, '');
  for (const b of d.blocks) {
    if (b.t === 'h') out.push(b.text.toUpperCase());
    else if (b.t === 'p') out.push(b.text);
    else if (b.t === 'list') out.push(...b.items.map((i) => `  • ${i}`));
    else {
      out.push(`${b.num}${b.title ? ` ${b.title}` : ''}${b.text ? `${b.title ? '. ' : ' '}${b.text}` : ''}`);
      b.subs?.forEach((s, i) => out.push(`   ${b.num.replace(/\.$/, '')}.${i + 1} ${s}`));
    }
    out.push('');
  }
  if (d.closing) out.push(d.closing, '');
  for (const s of d.signatures) out.push(s.label, ...s.lines, '');
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

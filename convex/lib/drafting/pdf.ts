import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { DocModel } from './model';

/**
 * Renders a DocModel to an A4 PDF with pdf-lib (pure JS, runs in Convex's
 * default runtime). Standard fonts only cover Windows-1252, so text is
 * cleaned first; documents are always in English.
 */

const A4 = { w: 595.28, h: 841.89 };
const M = { x: 64, top: 64, bottom: 72 };
const INK = rgb(0.09, 0.14, 0.11);
const MUTED = rgb(0.42, 0.47, 0.44);

const SAFE = /[^\x20-\x7E -ÿ–—‘’“”•…€]/g;
const clean = (s: string) => s.replace(/\t/g, '  ').replace(/[‐-‒]/g, '-').replace(SAFE, '?');

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

class Writer {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  constructor(
    private doc: PDFDocument,
    private fonts: Fonts,
  ) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.pages.push(this.page);
    this.y = A4.h - M.top;
  }
  ensure(height: number) {
    if (this.y - height < M.bottom) this.newPage();
  }
  wrap(text: string, font: PDFFont, size: number, width: number) {
    const out: string[] = [];
    for (const rawLine of clean(text).split('\n')) {
      const words = rawLine.split(/ +/);
      let line = '';
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width) {
          line = next;
          continue;
        }
        if (line) out.push(line);
        // Break very long words.
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width) {
          let i = w.length;
          while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
          out.push(w.slice(0, i));
          w = w.slice(i);
        }
        line = w;
      }
      out.push(line);
    }
    return out;
  }
  text(
    text: string,
    opts: { size?: number; font?: keyof Fonts; indent?: number; align?: 'left' | 'right' | 'center'; color?: ReturnType<typeof rgb>; gapAfter?: number; leading?: number; width?: number } = {},
  ) {
    const size = opts.size ?? 10.5;
    const font = this.fonts[opts.font ?? 'regular'];
    const indent = opts.indent ?? 0;
    const width = opts.width ?? A4.w - M.x * 2 - indent;
    const leading = opts.leading ?? size * 1.42;
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(leading);
      const lw = font.widthOfTextAtSize(line, size);
      const x =
        opts.align === 'right' ? A4.w - M.x - lw : opts.align === 'center' ? (A4.w - lw) / 2 : M.x + indent;
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= leading;
    }
    this.y -= opts.gapAfter ?? 0;
  }
  /** A numbered paragraph: the number sits beside the first line, on the same page. */
  numbered(label: string, text: string, labelIndent: number, textIndent: number) {
    const size = 10.5;
    const leading = size * 1.42;
    const lines = this.wrap(text, this.fonts.regular, size, A4.w - M.x * 2 - textIndent);
    lines.forEach((line, i) => {
      this.ensure(leading);
      if (i === 0) this.page.drawText(label, { x: M.x + labelIndent, y: this.y - size, size, font: this.fonts.regular, color: INK });
      this.page.drawText(line, { x: M.x + textIndent, y: this.y - size, size, font: this.fonts.regular, color: INK });
      this.y -= leading;
    });
    this.y -= 3;
  }
  gap(h: number) {
    this.y -= h;
  }
  rule() {
    this.ensure(10);
    this.page.drawLine({ start: { x: M.x, y: this.y }, end: { x: A4.w - M.x, y: this.y }, thickness: 0.6, color: rgb(0.85, 0.87, 0.85) });
    this.y -= 10;
  }
}

export async function renderPdf(d: DocModel, meta: { reference: string; brand: string }) {
  const doc = await PDFDocument.create();
  doc.setTitle(clean(d.title));
  doc.setCreator(meta.brand);
  doc.setProducer(meta.brand);
  doc.setSubject(`Ref ${meta.reference}`);
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const w = new Writer(doc, fonts);

  if (d.kind === 'letter') {
    for (const line of d.sender ?? []) w.text(line, { align: 'right' });
    w.gap(18);
    for (const line of d.recipient ?? []) w.text(line);
    w.gap(14);
    w.text(d.date);
    for (const r of d.refs ?? []) w.text(r, { color: MUTED });
    w.gap(14);
    if (d.salutation) w.text(d.salutation, { gapAfter: 8 });
    if (d.subject) w.text(d.subject, { font: 'bold', gapAfter: 8 });
  } else {
    w.text(d.title.toUpperCase(), { size: 16, font: 'bold', align: 'center', gapAfter: 6 });
    w.text(d.date, { align: 'center', color: MUTED, gapAfter: 14 });
    w.rule();
  }

  for (const b of d.blocks) {
    if (b.t === 'h') {
      w.ensure(40);
      w.gap(6);
      w.text(b.text.toUpperCase(), { font: 'bold', size: 10, gapAfter: 4 });
    } else if (b.t === 'p') {
      w.text(b.text, { font: b.bold ? 'bold' : b.italic ? 'italic' : 'regular', gapAfter: 8 });
    } else if (b.t === 'list') {
      for (const item of b.items) w.text(item, { indent: 12, gapAfter: 4 });
      w.gap(4);
    } else {
      w.ensure(30);
      const head = `${b.num} ${b.title ?? ''}`.trim();
      if (b.title) w.text(head, { font: 'bold', gapAfter: 2 });
      if (b.text) w.text(b.title ? b.text : `${b.num} ${b.text}`, { indent: 18, gapAfter: b.subs?.length ? 4 : 8 });
      b.subs?.forEach((s, i) => w.numbered(`${b.num.replace(/\.$/, '')}.${i + 1}`, s, 18, 44));
      if (b.subs?.length) w.gap(5);
    }
  }

  if (d.closing) {
    w.gap(6);
    w.text(d.closing);
  }
  for (const s of d.signatures) {
    w.ensure(110);
    w.gap(d.kind === 'agreement' ? 22 : 4);
    if (s.label) w.text(s.label, { font: 'bold', gapAfter: 8 });
    for (const line of s.lines) {
      if (line) w.text(line, { gapAfter: d.kind === 'agreement' ? 10 : 0 });
      else w.gap(14);
    }
  }

  // Footer on every page.
  const total = w.pages.length;
  w.pages.forEach((p, i) => {
    const left = clean(`${meta.brand} · Ref ${meta.reference} · A template filled in with your details. Information, not legal advice.`);
    p.drawText(left, { x: M.x, y: 36, size: 7.5, font: fonts.regular, color: MUTED });
    const right = `Page ${i + 1} of ${total}`;
    p.drawText(right, { x: A4.w - M.x - fonts.regular.widthOfTextAtSize(right, 7.5), y: 36, size: 7.5, font: fonts.regular, color: MUTED });
  });

  return { bytes: await doc.save(), pages: total };
}

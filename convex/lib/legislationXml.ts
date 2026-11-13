/** Minimal CLML (legislation.gov.uk XML) and GOV.UK content parsing. No DOM in the Convex runtime. */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function stripTags(xml: string) {
  return decodeEntities(xml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Parses one section's data.xml: heading, plain text (with (1), (a) numbering), in-force and version date. */
export function parseSectionXml(xml: string) {
  const body = xml.match(/<(EU)?Body[\s>][\s\S]*<\/(EU)?Body>/)?.[0] ?? '';
  if (!body) return null;
  const group = body.match(/<P1group[\s>][\s\S]*<\/P1group>/)?.[0];
  const scope = group ?? body;
  const heading = stripTags(scope.match(/<Title>([\s\S]*?)<\/Title>/)?.[1] ?? '').replace(/[.:]\s*$/, '');
  const p1 = scope.match(/<P1[\s>][\s\S]*<\/P1>/)?.[0] ?? scope;
  const text = stripTags(
    p1
      .replace(/<CommentaryRef[^>]*\/>/g, '')
      .replace(/<Pnumber[^>]*>([\s\S]*?)<\/Pnumber>/g, (_, n) => ` (${stripTags(n)}) `)
      .replace(/<\/Text>/g, '</Text> '),
  )
    .replace(/^\(\w+\)\s*/, '') // drop the section number itself
    .replace(/\[\s*F\d+\s*/g, '[')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([“‘(])\s+/g, '$1')
    .replace(/\s+([”’)])/g, '$1');
  const prospective = /Status="Prospective"/.test(xml.match(/<(EU)?Body[^>]*>/)?.[0] ?? '') || /Match="false"[^>]*Status="Prospective"/.test(xml);
  const repealed = /^[.\s…]+$/.test(text) || text.length < 15;
  const versionDate =
    xml.match(/<dct:valid>([\d-]+)<\/dct:valid>/)?.[1] ?? xml.match(/<dc:modified>([\d-]+)<\/dc:modified>/)?.[1] ?? new Date().toISOString().slice(0, 10);
  return { heading, text: text.slice(0, 7000), inForce: !prospective && !repealed, versionDate };
}

/** Pulls one part of a GOV.UK guide from the Content API JSON. */
export function parseGovukPart(json: unknown, slug: string) {
  const d = json as { title?: string; public_updated_at?: string; details?: { parts?: { slug: string; title: string; body?: string }[]; body?: string } };
  const part = d.details?.parts?.find((p) => p.slug === slug);
  const html = part?.body ?? d.details?.body;
  if (!html) return null;
  return {
    heading: part?.title ?? d.title ?? slug,
    text: stripTags(html.replace(/<\/(p|li|h\d)>/g, '. ')).replace(/\.\s*\./g, '.').slice(0, 7000),
    inForce: true,
    versionDate: (d.public_updated_at ?? new Date().toISOString()).slice(0, 10),
  };
}

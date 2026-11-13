import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { EMBED_DIMENSIONS, embedText, hashEmbedding } from './lib/gemini';
import { parseGovukPart, parseSectionXml } from './lib/legislationXml';
import { CORPUS, corpusUrl, type CorpusEntry } from './seed/legislation';

/**
 * Legislation corpus and retrieval (mvp2.md §6.1).
 * legislation.gov.uk and GOV.UK content, Open Government Licence v3.0.
 */

const chunkFields = {
  act: v.string(),
  section: v.string(),
  heading: v.string(),
  url: v.string(),
  text: v.string(),
  topics: v.array(v.string()),
  inForce: v.boolean(),
  versionDate: v.string(),
  source: v.union(v.literal('legislation.gov.uk'), v.literal('gov.uk'), v.literal('fixture')),
  embedding: v.array(v.float64()),
  embeddingModel: v.string(),
};

/** Upserts by act + section. A fixture never overwrites official text. */
export const saveChunk = internalMutation({
  args: chunkFields,
  handler: async (ctx, chunk) => {
    const existing = await ctx.db
      .query('legislationChunks')
      .withIndex('by_act_and_section', (q) => q.eq('act', chunk.act).eq('section', chunk.section))
      .unique();
    if (existing) {
      if (chunk.source === 'fixture' && existing.source !== 'fixture') return existing._id;
      await ctx.db.patch(existing._id, chunk);
      return existing._id;
    }
    return await ctx.db.insert('legislationChunks', chunk);
  },
});

export const existingChunk = internalQuery({
  args: { act: v.string(), section: v.string() },
  handler: async (ctx, { act, section }) => {
    const c = await ctx.db
      .query('legislationChunks')
      .withIndex('by_act_and_section', (q) => q.eq('act', act).eq('section', section))
      .unique();
    return c ? { source: c.source, versionDate: c.versionDate, embeddingModel: c.embeddingModel } : null;
  },
});

async function fetchEntry(e: CorpusEntry) {
  if (e.kind === 'legislation') {
    const res = await fetch(`https://www.legislation.gov.uk/${e.path}/${e.unit}/${e.section}/data.xml`, {
      headers: { Accept: 'application/xml' },
    });
    if (!res.ok) throw new Error(`legislation.gov.uk ${res.status}`);
    return parseSectionXml(await res.text());
  }
  const res = await fetch(`https://www.gov.uk/api/content${e.path}`);
  if (!res.ok) throw new Error(`gov.uk ${res.status}`);
  return parseGovukPart(await res.json(), e.part);
}

async function embedOrHash(text: string) {
  try {
    const { vector, model } = await embedText(text, 'RETRIEVAL_DOCUMENT');
    return { embedding: vector, embeddingModel: model };
  } catch (err) {
    console.warn('embedding failed, storing hash embedding', String(err).slice(0, 200));
    return { embedding: hashEmbedding(text), embeddingModel: 'hash-v1' };
  }
}

/** Fetches, parses, embeds and stores one Act's corpus sections (or one GOV.UK guide). */
export const ingestAct = internalAction({
  args: { act: v.string(), fixturesOnly: v.optional(v.boolean()) },
  handler: async (ctx, { act, fixturesOnly }) => {
    const entries = CORPUS.filter((e) => e.act === act);
    let official = 0;
    let fixtures = 0;
    for (const e of entries) {
      let parsed: { heading: string; text: string; inForce: boolean; versionDate: string } | null = null;
      if (!fixturesOnly) {
        try {
          parsed = await fetchEntry(e);
        } catch (err) {
          console.warn(`fetch failed for ${e.act} ${e.section}`, String(err).slice(0, 200));
        }
      }
      if (parsed) {
        const heading = parsed.heading || e.heading;
        await ctx.runMutation(internal.legislation.saveChunk, {
          act: e.act,
          section: e.section,
          heading,
          url: corpusUrl(e),
          text: parsed.text,
          topics: e.topics,
          inForce: parsed.inForce,
          versionDate: parsed.versionDate,
          source: e.kind === 'legislation' ? 'legislation.gov.uk' : 'gov.uk',
          ...(await embedOrHash(`${e.act} ${e.section}: ${heading}\n${parsed.text}`)),
        });
        official++;
      } else {
        const existing = await ctx.runQuery(internal.legislation.existingChunk, { act: e.act, section: e.section });
        if (existing && existing.source !== 'fixture') continue;
        await ctx.runMutation(internal.legislation.saveChunk, {
          act: e.act,
          section: e.section,
          heading: e.heading,
          url: corpusUrl(e),
          text: e.fixture,
          topics: e.topics,
          inForce: true,
          versionDate: 'fixture',
          source: 'fixture',
          ...(await embedOrHash(`${e.act} ${e.section}: ${e.heading}\n${e.fixture}`)),
        });
        fixtures++;
      }
    }
    return { act, official, fixtures };
  },
});

/** Weekly refresh (crons.ts) and first-time seeding. */
export const ingestAll = internalAction({
  args: { fixturesOnly: v.optional(v.boolean()) },
  handler: async (ctx, { fixturesOnly }) => {
    const acts = [...new Set(CORPUS.map((e) => e.act))];
    const results: { act: string; official: number; fixtures: number }[] = [];
    for (const act of acts) {
      results.push(await ctx.runAction(internal.legislation.ingestAct, { act, fixturesOnly }));
    }
    return results;
  },
});

export type RetrievedChunk = Pick<Doc<'legislationChunks'>, '_id' | 'act' | 'section' | 'heading' | 'url' | 'text' | 'topics' | 'versionDate' | 'source'> & {
  score: number;
};

export const loadChunks = internalQuery({
  args: { hits: v.array(v.object({ id: v.id('legislationChunks'), score: v.number() })) },
  handler: async (ctx, { hits }): Promise<RetrievedChunk[]> => {
    const out: RetrievedChunk[] = [];
    for (const hit of hits) {
      const c = await ctx.db.get(hit.id);
      if (!c || !c.inForce) continue;
      out.push({
        _id: c._id,
        act: c.act,
        section: c.section,
        heading: c.heading,
        url: c.url,
        text: c.text,
        topics: c.topics,
        versionDate: c.versionDate,
        source: c.source,
        score: hit.score,
      });
    }
    return out;
  },
});

/** Full-text fallback when the question cannot be embedded. */
export const searchText = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const rows = await ctx.db
      .query('legislationChunks')
      .withSearchIndex('search_text', (q) => q.search('text', query.slice(0, 500)).eq('inForce', true))
      .take(8);
    return rows.map((r, i) => ({ id: r._id, score: 1 - i * 0.05 }));
  },
});

export const byTopic = internalQuery({
  args: { topic: v.string() },
  handler: async (ctx, { topic }) => {
    const rows = await ctx.db.query('legislationChunks').take(200);
    return rows.filter((r) => r.inForce && r.topics.includes(topic)).slice(0, 6).map((r) => ({ id: r._id, score: 0.3 }));
  },
});

/**
 * Embed the question, vector search, hydrate, then prefer chunks whose topics
 * match the triage topic (topping up with the best other hits).
 */
export const retrieve = internalAction({
  args: { question: v.string(), topic: v.string() },
  handler: async (ctx, { question, topic }): Promise<{ chunks: RetrievedChunk[]; method: string }> => {
    let hits: { id: Id<'legislationChunks'>; score: number }[] = [];
    let method = 'vector';
    try {
      const { vector } = await embedText(question, 'RETRIEVAL_QUERY');
      if (vector.length !== EMBED_DIMENSIONS) throw new Error('bad dimensions');
      const results = await ctx.vectorSearch('legislationChunks', 'by_embedding', {
        vector,
        limit: 8,
        filter: (q) => q.eq('inForce', true),
      });
      hits = results.map((r) => ({ id: r._id, score: r._score }));
    } catch (err) {
      console.warn('vector retrieval failed, using text search', String(err).slice(0, 200));
      method = 'text';
      hits = await ctx.runQuery(internal.legislation.searchText, { query: question });
    }
    if (hits.length < 3) {
      method += '+topic';
      const extra = await ctx.runQuery(internal.legislation.byTopic, { topic });
      for (const e of extra) if (!hits.some((h) => h.id === e.id)) hits.push(e);
    }
    const chunks = await ctx.runQuery(internal.legislation.loadChunks, { hits });
    const onTopic = chunks.filter((c) => c.topics.includes(topic));
    const rest = chunks.filter((c) => !c.topics.includes(topic));
    return { chunks: [...onTopic, ...rest].slice(0, 6), method };
  },
});

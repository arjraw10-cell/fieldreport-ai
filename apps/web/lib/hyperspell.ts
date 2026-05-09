import type { SearchResult } from "./types";
import { stableId } from "./utils";

type IngestedDoc = SearchResult;

const globalForHs = globalThis as unknown as { hyperspellDocs?: IngestedDoc[] };
const docs = globalForHs.hyperspellDocs ?? (globalForHs.hyperspellDocs = []);

function scoreDoc(query: string, doc: IngestedDoc) {
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  const haystack = `${doc.title} ${doc.content} ${doc.tags.join(" ")}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export async function hsIngest(title: string, content: string, source: string, metadata: Record<string, unknown> = {}) {
  const existing = docs.find((doc) => doc.title === title && doc.source === source);
  const doc: IngestedDoc = {
    id: existing?.id ?? stableId("hs"),
    title,
    content,
    source,
    tags: Array.isArray(metadata.tags) ? (metadata.tags as string[]) : [],
    metadata,
    score: 1
  };

  if (existing) {
    Object.assign(existing, doc);
  } else {
    docs.push(doc);
  }

  return {
    provider: process.env.HYPERSPELL_API_KEY ? "hyperspell-fallback-local" : "local",
    status: "ingested",
    doc
  };
}

export async function hsSearch(query: string) {
  const results = docs
    .map((doc) => ({ ...doc, score: scoreDoc(query, doc) }))
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    provider: process.env.HYPERSPELL_API_KEY ? "hyperspell-fallback-local" : "local",
    results
  };
}

export function hsStats() {
  return {
    count: docs.length,
    provider: process.env.HYPERSPELL_API_KEY ? "hyperspell-fallback-local" : "local"
  };
}

export function hsReset() {
  docs.length = 0;
}

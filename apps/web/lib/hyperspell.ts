import type { SearchResult } from "./types";
import { stableId } from "./utils";

type IngestedDoc = SearchResult;

const HYPERSPELL_BASE = "https://api.hyperspell.com/v1";
const HS_KEY = process.env.HYPERSPELL_API_KEY ?? "";

const globalForHs = globalThis as unknown as { hyperspellDocs?: IngestedDoc[] };
const docs = globalForHs.hyperspellDocs ?? (globalForHs.hyperspellDocs = []);

function scoreDoc(query: string, doc: IngestedDoc) {
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  const haystack = `${doc.title} ${doc.content} ${doc.tags.join(" ")}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

async function callHyperspell<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${HYPERSPELL_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HS_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hyperspell API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
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

  const useApi = !!process.env.HYPERSPELL_API_KEY;

  if (useApi) {
    try {
      await callHyperspell("/documents", { title, content, source, ...metadata });
    } catch (err) {
      console.warn("[hyperspell] Ingest API failed, falling back to local:", err);
    }
  }

  // Always index locally so the demo works
  if (existing) {
    Object.assign(existing, doc);
  } else {
    docs.push(doc);
  }

  return {
    provider: useApi ? "hyperspell+local" : "local",
    status: "ingested",
    doc
  };
}

export async function hsSearch(query: string) {
  const useApi = !!process.env.HYPERSPELL_API_KEY;

  if (useApi) {
    try {
      const res = await callHyperspell<{
        documents?: Array<{ title?: string; content?: string; source?: string; metadata?: Record<string, unknown>; score?: number }>;
        answer?: string;
      }>("/memories/search", { query });

      const results: IngestedDoc[] = (res.documents ?? []).map((d, i) => ({
        id: `hs-${i}`,
        title: d.title ?? "Hyperspell result",
        content: d.content ?? "",
        source: d.source ?? "hyperspell",
        tags: Array.isArray(d.metadata?.tags) ? (d.metadata.tags as string[]) : [],
        metadata: d.metadata ?? {},
        score: d.score ?? 1
      }));

      return { provider: "hyperspell", results };
    } catch (err) {
      console.warn("[hyperspell] Search API failed, falling back to local:", err);
    }
  }

  const results = docs
    .map((doc) => ({ ...doc, score: scoreDoc(query, doc) }))
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    provider: useApi ? "hyperspell-fallback-local" : "local",
    results
  };
}

export function hsStats() {
  return {
    count: docs.length,
    provider: !!process.env.HYPERSPELL_API_KEY ? "hyperspell" : "local"
  };
}

export function hsReset() {
  docs.length = 0;
}

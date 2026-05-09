import type { SearchResult } from "./types";
import { readJsonFile, readSampleReportFiles, readTextFile, stableId } from "./utils";

const NIA_BASE = "https://apigcp.trynia.ai/v2";

const globalForNia = globalThis as unknown as { niaDocs?: SearchResult[] };
const docs = globalForNia.niaDocs ?? (globalForNia.niaDocs = []);

function score(query: string, doc: SearchResult, tags?: string[]) {
  const tagBoost = tags?.some((tag) => doc.tags.includes(tag)) ? 3 : 0;
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
  const haystack = `${doc.title} ${doc.content} ${doc.tags.join(" ")}`.toLowerCase();
  return terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), tagBoost);
}

function ensureLocalCorpus() {
  if (docs.length > 0) return;

  for (const report of readSampleReportFiles()) {
    niaIndexSync(`Past DUI report ${report.file}`, report.content, ["dui", "metro-pd", "past-report"], {
      source: report.file
    });
  }

  const feedback = readJsonFile<Array<{ source: string; author: string; content: string }>>("sample-feedback.json");
  feedback.forEach((item, index) => {
    niaIndexSync(`${item.source} from ${item.author} ${index + 1}`, item.content, ["dui", "feedback", "requirements"], {
      source: `sample-feedback:${index + 1}`
    });
  });

  niaIndexSync("Miranda policy", readTextFile("sample-policies", "miranda-policy.md"), ["policy", "miranda", "dui"], {
    source: "miranda-policy.md"
  });
  niaIndexSync("SFST policy", readTextFile("sample-policies", "sfst-policy.md"), ["policy", "sfst", "dui"], {
    source: "sfst-policy.md"
  });
}

function niaIndexSync(title: string, content: string, tags: string[] = [], metadata: Record<string, unknown> = {}) {
  const existing = docs.find((doc) => doc.title === title);
  const doc: SearchResult = {
    id: existing?.id ?? stableId("nia"),
    title,
    content,
    source: String(metadata.source ?? "local"),
    tags,
    metadata,
    score: 1
  };

  if (existing) {
    Object.assign(existing, doc);
  } else {
    docs.push(doc);
  }

  return { provider: "local", status: "indexed", doc };
}

async function callNia<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${NIA_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NIA_API_KEY}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Nia API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function niaIndex(title: string, content: string, tags: string[] = [], metadata: Record<string, unknown> = {}) {
  const useApi = !!process.env.NIA_API_KEY;

  if (useApi) {
    try {
      const sourceId = stableId("nia");
      await callNia("/sources", {
        type: "text",
        display_name: title,
        content,
        metadata: { tags, ...metadata, _sourceId: sourceId }
      });
      return {
        provider: "nia",
        status: "indexed",
        doc: { id: sourceId, title, content, source: String(metadata.source ?? "nia"), tags, metadata, score: 1 } as SearchResult
      };
    } catch (err) {
      console.warn("[nia] Real API failed, falling back to local:", err);
    }
  }

  return niaIndexSync(title, content, tags, metadata);
}

export async function niaSearch(query: string, tags?: string[], limit = 5) {
  const useApi = !!process.env.NIA_API_KEY;

  if (useApi) {
    try {
      const res = await callNia<{ results?: Array<{ display_name?: string; content?: string; source_name?: string; metadata?: Record<string, unknown>; score?: number }> }>("/search", {
        mode: "query",
        messages: [{ role: "user", content: query }]
      });

      const results: SearchResult[] = (res.results ?? []).slice(0, limit).map((r, i) => ({
        id: `nia-${i}`,
        title: r.display_name ?? "Nia result",
        content: r.content ?? "",
        source: r.source_name ?? "nia",
        tags: Array.isArray(r.metadata?.tags) ? (r.metadata.tags as string[]) : [],
        metadata: r.metadata ?? {},
        score: r.score ?? 1
      }));

      return { provider: "nia", query, results };
    } catch (err) {
      console.warn("[nia] Search API failed, falling back to local:", err);
    }
  }

  ensureLocalCorpus();
  const results = docs
    .map((doc) => ({ ...doc, score: score(query, doc, tags) }))
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { provider: useApi ? "nia-fallback-local" : "local", query, results };
}

export function niaStats() {
  ensureLocalCorpus();
  return {
    count: docs.length,
    provider: !!process.env.NIA_API_KEY ? "nia" : "local"
  };
}

export function niaReset() {
  docs.length = 0;
}

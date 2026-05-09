import type { SearchResult } from "./types";
import { readJsonFile, readSampleReportFiles, readTextFile, stableId } from "./utils";

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
    niaIndex(`Past DUI report ${report.file}`, report.content, ["dui", "metro-pd", "past-report"], {
      source: report.file
    });
  }

  const feedback = readJsonFile<Array<{ source: string; author: string; content: string }>>("sample-feedback.json");
  feedback.forEach((item, index) => {
    niaIndex(`${item.source} from ${item.author} ${index + 1}`, item.content, ["dui", "feedback", "requirements"], {
      source: `sample-feedback:${index + 1}`
    });
  });

  niaIndex("Miranda policy", readTextFile("sample-policies", "miranda-policy.md"), ["policy", "miranda", "dui"], {
    source: "miranda-policy.md"
  });
  niaIndex("SFST policy", readTextFile("sample-policies", "sfst-policy.md"), ["policy", "sfst", "dui"], {
    source: "sfst-policy.md"
  });
}

export function niaIndex(title: string, content: string, tags: string[] = [], metadata: Record<string, unknown> = {}) {
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

  return {
    provider: process.env.NIA_API_KEY ? "nia-fallback-local" : "local",
    status: "indexed",
    doc
  };
}

export async function niaSearch(query: string, tags?: string[], limit = 5) {
  ensureLocalCorpus();
  const results = docs
    .map((doc) => ({ ...doc, score: score(query, doc, tags) }))
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    provider: process.env.NIA_API_KEY ? "nia-fallback-local" : "local",
    query,
    results
  };
}

export function niaStats() {
  ensureLocalCorpus();
  return {
    count: docs.length,
    provider: process.env.NIA_API_KEY ? "nia-fallback-local" : "local"
  };
}

export function niaReset() {
  docs.length = 0;
}

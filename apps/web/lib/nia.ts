import type { SearchResult } from "./types";
import { getSampleReportFiles, stableId } from "./utils";
import { SUPERVISOR_FEEDBACK, POLICIES } from "./sample-data";

const NIA_BASE = "https://api.trynia.ai/v1";

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

  for (const report of getSampleReportFiles()) {
    niaIndexSync(`Past DUI report ${report.file}`, report.content, ["dui", "metro-pd", "past-report"], {
      source: report.file
    });
  }

  SUPERVISOR_FEEDBACK.forEach((item, index) => {
    niaIndexSync(`${item.source} from ${item.author} ${index + 1}`, item.content, ["dui", "feedback", "requirements"], {
      source: `sample-feedback:${index + 1}`,
      author: item.author,
      channel: "channel" in item ? item.channel : undefined
    });
  });

  niaIndexSync("Miranda policy", POLICIES.miranda, ["policy", "miranda", "dui"], {
    source: "miranda-policy.md"
  });
  niaIndexSync("SFST policy", POLICIES.sfst, ["policy", "sfst", "dui"], {
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
  if (process.env.NIA_API_KEY) {
    try {
      await callNia("/documents", { title, content, tags, metadata });
    } catch (err) {
      console.warn("[nia] Real API failed, falling back to local:", err);
    }
  }

  return niaIndexSync(title, content, tags, metadata);
}

export async function niaSearch(query: string, tags?: string[], limit = 5) {
  if (process.env.NIA_API_KEY) {
    try {
      const res = await callNia<{ results?: Array<{ title?: string; content?: string; source?: string; tags?: string[]; metadata?: Record<string, unknown>; score?: number }> }>("/search", {
        query,
        filters: tags ? { tags } : undefined,
        limit
      });

      const results: SearchResult[] = (res.results ?? []).slice(0, limit).map((r, i) => ({
        id: `nia-${i}`,
        title: r.title ?? "Nia result",
        content: r.content ?? "",
        source: r.source ?? "nia",
        tags: r.tags ?? [],
        metadata: r.metadata ?? {},
        score: r.score ?? 1
      }));

      return { provider: "nia" as const, query, results };
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

  return { provider: (process.env.NIA_API_KEY ? "nia-fallback-local" : "local") as "nia-fallback-local" | "local", query, results };
}

export function niaStats() {
  ensureLocalCorpus();
  return {
    count: docs.length,
    provider: !!process.env.NIA_API_KEY ? "nia+local" : "local"
  };
}

export function niaReset() {
  docs.length = 0;
}

// ── Cross-session context ──────────────────────────────────────────
const globalForFindings = globalThis as unknown as {
  niaFindings?: Record<string, Array<{ key: string; value: string; session: string; ts: string }>>;
};
const findingsStore = globalForFindings.niaFindings ?? (globalForFindings.niaFindings = {});

export async function saveFindings(sessionId: string, findings: Array<{ key: string; value: string }>) {
  if (process.env.NIA_API_KEY) {
    try {
      await fetch(`${NIA_BASE}/findings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.NIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, findings })
      });
    } catch (err) {
      console.error("[Nia] saveFindings API failed, falling back to local:", err);
    }
  }

  if (!findingsStore[sessionId]) findingsStore[sessionId] = [];
  for (const f of findings) {
    findingsStore[sessionId].push({ ...f, session: sessionId, ts: new Date().toISOString() });
  }

  return { saved: findings.length, provider: process.env.NIA_API_KEY ? "nia+local" : "local" };
}

export async function getCrossSessionContext(caseId: string) {
  if (process.env.NIA_API_KEY) {
    try {
      const res = await fetch(`${NIA_BASE}/findings?session_id=${caseId}`, {
        headers: { Authorization: `Bearer ${process.env.NIA_API_KEY}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.findings?.length) {
          return { provider: "nia" as const, findings: data.findings };
        }
      }
    } catch (err) {
      console.error("[Nia] getCrossSessionContext API failed, falling back to local:", err);
    }
  }

  const allFindings: Array<{ key: string; value: string; session: string; ts: string }> = [];
  for (const [sid, entries] of Object.entries(findingsStore)) {
    if (sid.includes(caseId) || sid === caseId) {
      allFindings.push(...entries);
    }
  }

  return {
    provider: (process.env.NIA_API_KEY ? "nia-fallback-local" : "local") as "nia-fallback-local" | "local",
    findings: allFindings
  };
}

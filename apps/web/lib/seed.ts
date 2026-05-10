import { hsIngest, hsReset } from "./hyperspell";
import { niaIndex, niaReset, niaStats } from "./nia";
import { getDatabaseProviderInfo } from "./insforge";
import { getSampleReportFiles } from "./utils";
import { SUPERVISOR_FEEDBACK, POLICIES } from "./sample-data";

export async function initializeDepartmentBrain() {
  const seededCase = { id: "demo", case_number: "demo" };
  hsReset();
  niaReset();
  const ingested: Array<{ title: string; source: string }> = [];

  // ── Past reports (from Google Drive) ──
  for (const report of getSampleReportFiles()) {
    const title = `Past DUI report ${report.file}`;
    const tags = ["dui", "metro-pd", "past-report"];
    await hsIngest(title, report.content, "google_drive", { tags, originalPath: `/Metro PD/Incident Reports/${report.file}` });
    await niaIndex(title, report.content, tags, { source: report.file });
    ingested.push({ title, source: "google_drive" });
  }

  // ── Supervisor feedback (from Slack + Gmail) ──
  for (const [index, item] of SUPERVISOR_FEEDBACK.entries()) {
    const title = `${item.source} from ${item.author} ${index + 1}`;
    const tags = ["dui", "feedback", "requirements"];
    const hsSource = item.source === "Slack" ? "slack" : "gmail";
    await hsIngest(title, item.content, hsSource, { tags, author: item.author, channel: "channel" in item ? item.channel : undefined });
    await niaIndex(title, item.content, tags, { source: `sample-feedback:${index + 1}`, author: item.author });
    ingested.push({ title, source: hsSource });
  }

  // ── Policies (from Google Drive) ──
  const policyEntries = [
    { title: "Miranda policy", content: POLICIES.miranda, file: "miranda-policy.md", tag: "miranda" },
    { title: "SFST policy", content: POLICIES.sfst, file: "sfst-policy.md", tag: "sfst" }
  ] as const;

  for (const { title, content, file, tag } of policyEntries) {
    const tags = ["dui", "policy", tag];
    await hsIngest(title, content, "google_drive", { tags, originalPath: `/Metro PD/Policies/${file}` });
    await niaIndex(title, content, tags, { source: file });
    ingested.push({ title, source: "google_drive" });
  }

  // ── Source breakdown for the demo UI ──
  const sources = {
    google_drive: { type: "reports + policies", count: ingested.filter((i) => i.source === "google_drive").length },
    slack: { type: "supervisor feedback", count: ingested.filter((i) => i.source === "slack").length },
    gmail: { type: "policy email", count: ingested.filter((i) => i.source === "gmail").length }
  };

  return {
    status: "initialized",
    case: seededCase,
    ingestedCount: ingested.length,
    ingested,
    sources,
    nia: niaStats(),
    hyperspell: { count: ingested.length, provider: process.env.HYPERSPELL_API_KEY ? "hyperspell+local" : "local" },
    database: getDatabaseProviderInfo()
  };
}

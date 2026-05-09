import { hsIngest, hsReset } from "./hyperspell";
import { niaIndex, niaReset, niaStats } from "./nia";
import { getDatabaseProviderInfo } from "./insforge";
import { resetDemoData } from "./db";
import { readJsonFile, readSampleReportFiles, readTextFile } from "./utils";

export async function initializeDepartmentBrain() {
  const seededCase = await resetDemoData();
  hsReset();
  niaReset();
  const ingested: Array<{ title: string; source: string }> = [];

  for (const report of readSampleReportFiles()) {
    const title = `Past DUI report ${report.file}`;
    const tags = ["dui", "metro-pd", "past-report"];
    await hsIngest(title, report.content, report.file, { tags });
    niaIndex(title, report.content, tags, { source: report.file });
    ingested.push({ title, source: report.file });
  }

  const feedback = readJsonFile<Array<{ source: string; author: string; content: string }>>("sample-feedback.json");
  for (const [index, item] of feedback.entries()) {
    const title = `${item.source} from ${item.author} ${index + 1}`;
    const tags = ["dui", "feedback", "requirements"];
    await hsIngest(title, item.content, item.source, { tags, author: item.author });
    niaIndex(title, item.content, tags, { source: `sample-feedback:${index + 1}`, author: item.author });
    ingested.push({ title, source: item.source });
  }

  const policies = [
    ["Miranda policy", "miranda-policy.md", "miranda"],
    ["SFST policy", "sfst-policy.md", "sfst"]
  ] as const;

  for (const [title, file, tag] of policies) {
    const content = readTextFile("sample-policies", file);
    const tags = ["dui", "policy", tag];
    await hsIngest(title, content, file, { tags });
    niaIndex(title, content, tags, { source: file });
    ingested.push({ title, source: file });
  }

  return {
    status: "initialized",
    case: seededCase,
    ingestedCount: ingested.length,
    ingested,
    nia: niaStats(),
    database: getDatabaseProviderInfo()
  };
}

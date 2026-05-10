import { PAST_REPORTS } from "./sample-data";

export function nowIso() {
  return new Date().toISOString();
}

export function getSampleReportFiles() {
  return PAST_REPORTS.map((report, index) => ({
    file: `dui-${String(index + 1).padStart(3, "0")}.json`,
    content: JSON.stringify(report)
  }));
}

export function stableId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function sourceMarker(ref: string) {
  return `[SOURCE:${ref}]`;
}

export function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

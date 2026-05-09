import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";

export function nowIso() {
  return new Date().toISOString();
}

export function projectRoot() {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), "../.."),
    path.resolve(process.cwd(), "../../..")
  ];
  const root = candidates.find((candidate) => existsSync(path.join(candidate, "data")));
  return root ?? process.cwd();
}

export function dataPath(...parts: string[]) {
  return path.join(projectRoot(), "data", ...parts);
}

export function readJsonFile<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(dataPath(...parts), "utf8")) as T;
}

export function readTextFile(...parts: string[]) {
  return readFileSync(dataPath(...parts), "utf8");
}

export function readSampleReportFiles() {
  const dir = dataPath("sample-reports");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({
      file,
      content: readFileSync(path.join(dir, file), "utf8")
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

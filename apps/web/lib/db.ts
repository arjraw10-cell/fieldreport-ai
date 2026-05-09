import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { AuditRecord, CaseRecord, DraftReport, ProcessedCaseState, ReportRecord } from "./types";
import { DEMO_CASE_NUMBER } from "./demo";
import { nowIso, stableId } from "./utils";

type Store = {
  cases: CaseRecord[];
  reports: ReportRecord[];
  audit: AuditRecord[];
};

const globalForStore = globalThis as unknown as {
  fieldReportStore?: Store;
  fieldReportPg?: ReturnType<typeof postgres>;
};

const memoryStore: Store =
  globalForStore.fieldReportStore ??
  (globalForStore.fieldReportStore = {
    cases: [],
    reports: [],
    audit: []
  });

const databaseUrl = process.env.DATABASE_URL;
const sqlClient: postgres.Sql<Record<string, unknown>> | null = databaseUrl
  ? globalForStore.fieldReportPg ?? (globalForStore.fieldReportPg = postgres(databaseUrl, { max: 1 }))
  : null;

export const drizzleDb = sqlClient ? drizzle(sqlClient) : null;

let pgReady = false;

async function ensurePg() {
  if (!sqlClient || pgReady) return;
  await sqlClient`
    create table if not exists cases (
      id text primary key,
      case_number text not null unique,
      incident_type text not null,
      status text not null,
      evidence_json jsonb,
      created_at timestamptz not null default now()
    )
  `;
  await sqlClient`
    create table if not exists reports (
      id text primary key,
      case_id text not null references cases(id),
      version integer not null,
      ai_draft jsonb not null,
      human_edit jsonb,
      final jsonb,
      status text not null,
      created_at timestamptz not null default now(),
      approved_by text,
      approved_at timestamptz
    )
  `;
  await sqlClient`
    create table if not exists audit (
      id serial primary key,
      report_id text not null references reports(id),
      action text not null,
      actor text not null,
      field text,
      before text,
      after text,
      evidence_ref text,
      created_at timestamptz not null default now()
    )
  `;
  pgReady = true;
}

function normalizeCase(row: any): CaseRecord {
  return {
    id: row.id,
    case_number: row.case_number,
    incident_type: row.incident_type,
    status: row.status,
    evidence_json: row.evidence_json ?? null,
    created_at: new Date(row.created_at).toISOString()
  };
}

function normalizeReport(row: any): ReportRecord {
  return {
    id: row.id,
    case_id: row.case_id,
    version: Number(row.version),
    ai_draft: row.ai_draft,
    human_edit: row.human_edit ?? null,
    final: row.final ?? null,
    status: row.status,
    created_at: new Date(row.created_at).toISOString(),
    approved_by: row.approved_by ?? null,
    approved_at: row.approved_at ? new Date(row.approved_at).toISOString() : null
  };
}

function normalizeAudit(row: any): AuditRecord {
  return {
    id: String(row.id),
    report_id: row.report_id,
    action: row.action,
    actor: row.actor,
    field: row.field ?? null,
    before: row.before ?? null,
    after: row.after ?? null,
    evidence_ref: row.evidence_ref ?? null,
    created_at: new Date(row.created_at).toISOString()
  };
}

export async function seedCase(caseNumber = DEMO_CASE_NUMBER) {
  const existing = await getCaseByNumber(caseNumber);
  if (existing) return existing;

  const record: CaseRecord = {
    id: stableId("case"),
    case_number: caseNumber,
    incident_type: "DUI Arrest",
    status: "open",
    evidence_json: null,
    created_at: nowIso()
  };

  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      insert into cases (id, case_number, incident_type, status, evidence_json, created_at)
      values (${record.id}, ${record.case_number}, ${record.incident_type}, ${record.status}, ${record.evidence_json}, ${record.created_at})
      returning *
    `;
    return normalizeCase(row);
  }

  memoryStore.cases.push(record);
  return record;
}

export async function getCaseByNumber(caseNumber: string) {
  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`select * from cases where case_number = ${caseNumber} limit 1`;
    return row ? normalizeCase(row) : null;
  }
  return memoryStore.cases.find((item) => item.case_number === caseNumber) ?? null;
}

export async function updateCaseEvidence(caseNumber: string, evidence: ProcessedCaseState) {
  const record = (await getCaseByNumber(caseNumber)) ?? (await seedCase(caseNumber));
  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      update cases
      set evidence_json = ${JSON.stringify(evidence)}::jsonb, status = 'processing'
      where id = ${record.id}
      returning *
    `;
    return normalizeCase(row);
  }
  record.evidence_json = evidence;
  record.status = "processing";
  return record;
}

export async function createReport(caseId: string, aiDraft: DraftReport) {
  const latestVersion = await getLatestReportVersion(caseId);
  const record: ReportRecord = {
    id: stableId("report"),
    case_id: caseId,
    version: latestVersion + 1,
    ai_draft: aiDraft,
    human_edit: null,
    final: null,
    status: "draft",
    created_at: nowIso(),
    approved_by: null,
    approved_at: null
  };

  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      insert into reports (id, case_id, version, ai_draft, human_edit, final, status, created_at)
      values (${record.id}, ${record.case_id}, ${record.version}, ${JSON.stringify(record.ai_draft)}::jsonb, null, null, ${record.status}, ${record.created_at})
      returning *
    `;
    return normalizeReport(row);
  }

  memoryStore.reports.push(record);
  return record;
}

async function getLatestReportVersion(caseId: string) {
  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`select coalesce(max(version), 0) as version from reports where case_id = ${caseId}`;
    return Number(row?.version ?? 0);
  }
  return memoryStore.reports.filter((report) => report.case_id === caseId).reduce((max, report) => Math.max(max, report.version), 0);
}

export async function getReport(reportId: string) {
  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`select * from reports where id = ${reportId} limit 1`;
    return row ? normalizeReport(row) : null;
  }
  return memoryStore.reports.find((report) => report.id === reportId) ?? null;
}

export async function getLatestReportForCase(caseId: string) {
  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`select * from reports where case_id = ${caseId} order by version desc limit 1`;
    return row ? normalizeReport(row) : null;
  }
  return (
    memoryStore.reports
      .filter((report) => report.case_id === caseId)
      .sort((a, b) => b.version - a.version)[0] ?? null
  );
}

export async function saveHumanEdit(reportId: string, draft: DraftReport, actor: string) {
  const report = await getReport(reportId);
  if (!report) throw new Error("Report not found");
  if (report.status === "approved") throw new Error("Approved reports cannot be edited");

  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      update reports
      set human_edit = ${JSON.stringify(draft)}::jsonb, status = 'reviewed'
      where id = ${reportId}
      returning *
    `;
    await addAudit({
      report_id: reportId,
      action: "human_edit",
      actor,
      field: "report",
      before: JSON.stringify(report.human_edit ?? report.ai_draft),
      after: JSON.stringify(draft),
      evidence_ref: null
    });
    return normalizeReport(row);
  }

  report.human_edit = draft;
  report.status = "reviewed";
  await addAudit({
    report_id: reportId,
    action: "human_edit",
    actor,
    field: "report",
    before: JSON.stringify(report.ai_draft),
    after: JSON.stringify(draft),
    evidence_ref: null
  });
  return report;
}

export async function approveReport(reportId: string, actor: string, finalDraft?: DraftReport) {
  const report = await getReport(reportId);
  if (!report) throw new Error("Report not found");
  const approvedAt = nowIso();
  const final = finalDraft ?? report.human_edit ?? report.ai_draft;

  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      update reports
      set final = ${JSON.stringify(final)}::jsonb, status = 'approved', approved_by = ${actor}, approved_at = ${approvedAt}
      where id = ${reportId}
      returning *
    `;
    await addAudit({
      report_id: reportId,
      action: "approved",
      actor,
      field: "status",
      before: report.status,
      after: "approved",
      evidence_ref: null
    });
    return normalizeReport(row);
  }

  const beforeStatus = report.status;
  report.final = final;
  report.status = "approved";
  report.approved_by = actor;
  report.approved_at = approvedAt;
  await addAudit({
    report_id: reportId,
    action: "approved",
    actor,
    field: "status",
    before: beforeStatus,
    after: "approved",
    evidence_ref: null
  });
  return report;
}

export async function addAudit(entry: Omit<AuditRecord, "id" | "created_at">) {
  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      insert into audit (report_id, action, actor, field, before, after, evidence_ref)
      values (${entry.report_id}, ${entry.action}, ${entry.actor}, ${entry.field}, ${entry.before}, ${entry.after}, ${entry.evidence_ref})
      returning *
    `;
    return normalizeAudit(row);
  }
  const row: AuditRecord = {
    id: stableId("audit"),
    ...entry,
    created_at: nowIso()
  };
  memoryStore.audit.push(row);
  return row;
}

export async function getAudit(reportId: string) {
  if (sqlClient) {
    await ensurePg();
    const rows = await sqlClient`select * from audit where report_id = ${reportId} order by created_at asc, id asc`;
    return rows.map(normalizeAudit);
  }
  return memoryStore.audit.filter((row) => row.report_id === reportId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function resetDemoData() {
  if (sqlClient) {
    await ensurePg();
    await sqlClient`delete from audit`;
    await sqlClient`delete from reports`;
    await sqlClient`delete from cases where case_number = ${DEMO_CASE_NUMBER}`;
  } else {
    memoryStore.audit.length = 0;
    memoryStore.reports.length = 0;
    memoryStore.cases.length = 0;
  }
  return seedCase();
}

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type {
  AuditRecord,
  CaseRecord,
  DraftReport,
  EvidenceRecord,
  MembershipRecord,
  OrganizationRecord,
  PolicyRecord,
  ProcessedCaseState,
  ReportRecord,
  UserRecord
} from "./types";
import { DEMO_CASE_NUMBER } from "./demo";
import { nowIso, stableId } from "./utils";

type UserRow = UserRecord & { password_hash: string };
type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

type Store = {
  users: UserRow[];
  organizations: OrganizationRecord[];
  memberships: MembershipRecord[];
  sessions: SessionRow[];
  cases: CaseRecord[];
  evidence: EvidenceRecord[];
  reports: ReportRecord[];
  audit: AuditRecord[];
  policies: PolicyRecord[];
};

const globalForStore = globalThis as unknown as {
  fieldReportStore?: Store;
  fieldReportPg?: ReturnType<typeof postgres>;
};

const memoryStore: Store =
  globalForStore.fieldReportStore ??
  (globalForStore.fieldReportStore = {
    users: [],
    organizations: [],
    memberships: [],
    sessions: [],
    cases: [],
    evidence: [],
    reports: [],
    audit: [],
    policies: []
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
    create table if not exists users (
      id text primary key,
      email text not null unique,
      name text not null,
      password_hash text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sqlClient`
    create table if not exists organizations (
      id text primary key,
      name text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sqlClient`
    create table if not exists memberships (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      org_id text not null references organizations(id) on delete cascade,
      role text not null,
      created_at timestamptz not null default now(),
      unique (user_id, org_id)
    )
  `;
  await sqlClient`
    create table if not exists sessions (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `;
  await sqlClient`
    create table if not exists cases (
      id text primary key,
      org_id text references organizations(id) on delete cascade,
      case_number text not null,
      title text,
      incident_type text not null,
      status text not null,
      evidence_json jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sqlClient`alter table cases add column if not exists org_id text references organizations(id) on delete cascade`;
  await sqlClient`alter table cases add column if not exists title text`;
  await sqlClient`alter table cases add column if not exists updated_at timestamptz not null default now()`;
  await sqlClient`create unique index if not exists cases_org_case_number_idx on cases (coalesce(org_id, ''), case_number)`;
  await sqlClient`
    create table if not exists evidence_items (
      id text primary key,
      case_id text not null references cases(id) on delete cascade,
      org_id text not null references organizations(id) on delete cascade,
      type text not null,
      title text not null,
      source_ref text not null,
      content jsonb not null,
      status text not null,
      error text,
      created_at timestamptz not null default now()
    )
  `;
  await sqlClient`
    create table if not exists reports (
      id text primary key,
      case_id text not null references cases(id) on delete cascade,
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
      report_id text not null references reports(id) on delete cascade,
      action text not null,
      actor text not null,
      field text,
      before text,
      after text,
      evidence_ref text,
      created_at timestamptz not null default now()
    )
  `;
  await sqlClient`
    create table if not exists policies (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      title text not null,
      content text not null,
      source text not null,
      created_at timestamptz not null default now()
    )
  `;

  pgReady = true;
}

function iso(value: unknown) {
  return new Date(value as string).toISOString();
}

function normalizeUser(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    created_at: iso(row.created_at)
  };
}

function normalizeOrganization(row: any): OrganizationRecord {
  return {
    id: row.id,
    name: row.name,
    created_at: iso(row.created_at)
  };
}

function normalizeMembership(row: any): MembershipRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    org_id: row.org_id,
    role: row.role,
    created_at: iso(row.created_at)
  };
}

function normalizeCase(row: any): CaseRecord {
  return {
    id: row.id,
    org_id: row.org_id ?? null,
    case_number: row.case_number,
    title: row.title ?? null,
    incident_type: row.incident_type,
    status: row.status,
    evidence_json: row.evidence_json ?? null,
    created_at: iso(row.created_at),
    updated_at: row.updated_at ? iso(row.updated_at) : iso(row.created_at)
  };
}

function normalizeEvidence(row: any): EvidenceRecord {
  return {
    id: row.id,
    case_id: row.case_id,
    org_id: row.org_id,
    type: row.type,
    title: row.title,
    source_ref: row.source_ref,
    content: row.content,
    status: row.status,
    error: row.error ?? null,
    created_at: iso(row.created_at)
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
    created_at: iso(row.created_at),
    approved_by: row.approved_by ?? null,
    approved_at: row.approved_at ? iso(row.approved_at) : null
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
    created_at: iso(row.created_at)
  };
}

function normalizePolicy(row: any): PolicyRecord {
  return {
    id: row.id,
    org_id: row.org_id,
    title: row.title,
    content: row.content,
    source: row.source,
    created_at: iso(row.created_at)
  };
}

export async function createUserWithOrganization(input: {
  email: string;
  name: string;
  passwordHash: string;
  organizationName: string;
}) {
  const existing = await getUserByEmail(input.email);
  if (existing) throw new Error("An account with that email already exists.");

  const createdAt = nowIso();
  const user: UserRow = {
    id: stableId("user"),
    email: input.email.toLowerCase(),
    name: input.name,
    password_hash: input.passwordHash,
    created_at: createdAt
  };
  const org: OrganizationRecord = {
    id: stableId("org"),
    name: input.organizationName,
    created_at: createdAt
  };
  const membership: MembershipRecord = {
    id: stableId("member"),
    user_id: user.id,
    org_id: org.id,
    role: "admin",
    created_at: createdAt
  };

  if (sqlClient) {
    await ensurePg();
    await sqlClient.begin(async (sql) => {
      await sql`insert into users (id, email, name, password_hash, created_at) values (${user.id}, ${user.email}, ${user.name}, ${user.password_hash}, ${user.created_at})`;
      await sql`insert into organizations (id, name, created_at) values (${org.id}, ${org.name}, ${org.created_at})`;
      await sql`insert into memberships (id, user_id, org_id, role, created_at) values (${membership.id}, ${membership.user_id}, ${membership.org_id}, ${membership.role}, ${membership.created_at})`;
    });
    return { user: normalizeUser(user), org, membership };
  }

  memoryStore.users.push(user);
  memoryStore.organizations.push(org);
  memoryStore.memberships.push(membership);
  return { user: normalizeUser(user), org, membership };
}

export async function getUserByEmail(email: string) {
  const normalized = email.toLowerCase();
  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`select * from users where email = ${normalized} limit 1`;
    return row ? ({ ...normalizeUser(row), password_hash: row.password_hash } as UserRow) : null;
  }
  return memoryStore.users.find((user) => user.email === normalized) ?? null;
}

export async function createSession(userId: string, tokenHash: string, expiresAt: string) {
  const row: SessionRow = {
    id: stableId("session"),
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_at: nowIso()
  };
  if (sqlClient) {
    await ensurePg();
    await sqlClient`
      insert into sessions (id, user_id, token_hash, expires_at, created_at)
      values (${row.id}, ${row.user_id}, ${row.token_hash}, ${row.expires_at}, ${row.created_at})
    `;
    return row;
  }
  memoryStore.sessions.push(row);
  return row;
}

export async function deleteSession(tokenHash: string) {
  if (sqlClient) {
    await ensurePg();
    await sqlClient`delete from sessions where token_hash = ${tokenHash}`;
    return;
  }
  const index = memoryStore.sessions.findIndex((session) => session.token_hash === tokenHash);
  if (index >= 0) memoryStore.sessions.splice(index, 1);
}

export async function getAuthContextBySession(tokenHash: string) {
  if (sqlClient) {
    await ensurePg();
    const [session] = await sqlClient`select * from sessions where token_hash = ${tokenHash} and expires_at > now() limit 1`;
    if (!session) return null;
    const [user] = await sqlClient`select * from users where id = ${session.user_id} limit 1`;
    const [membership] = await sqlClient`select * from memberships where user_id = ${session.user_id} order by created_at asc limit 1`;
    if (!user || !membership) return null;
    const [org] = await sqlClient`select * from organizations where id = ${membership.org_id} limit 1`;
    if (!org) return null;
    return {
      user: normalizeUser(user),
      org: normalizeOrganization(org),
      membership: normalizeMembership(membership)
    };
  }

  const session = memoryStore.sessions.find((item) => item.token_hash === tokenHash && item.expires_at > nowIso());
  if (!session) return null;
  const user = memoryStore.users.find((item) => item.id === session.user_id);
  const membership = memoryStore.memberships.find((item) => item.user_id === session.user_id);
  const org = membership ? memoryStore.organizations.find((item) => item.id === membership.org_id) : null;
  if (!user || !membership || !org) return null;
  return { user: normalizeUser(user), org, membership };
}

export async function createCase(input: {
  orgId?: string | null;
  caseNumber: string;
  title?: string;
  incidentType: string;
  status?: string;
}) {
  const record: CaseRecord = {
    id: stableId("case"),
    org_id: input.orgId ?? null,
    case_number: input.caseNumber,
    title: input.title ?? input.caseNumber,
    incident_type: input.incidentType,
    status: input.status ?? "open",
    evidence_json: null,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      insert into cases (id, org_id, case_number, title, incident_type, status, evidence_json, created_at, updated_at)
      values (${record.id}, ${record.org_id}, ${record.case_number}, ${record.title}, ${record.incident_type}, ${record.status}, ${record.evidence_json}, ${record.created_at}, ${record.updated_at})
      returning *
    `;
    return normalizeCase(row);
  }

  memoryStore.cases.push(record);
  return record;
}

export async function seedCase(caseNumber = DEMO_CASE_NUMBER) {
  const existing = await getCaseByNumber(caseNumber);
  if (existing) return existing;
  return createCase({
    caseNumber,
    incidentType: "DUI Arrest",
    status: "open",
    title: "Demo DUI arrest"
  });
}

export async function getCaseByNumber(caseNumber: string, orgId?: string | null) {
  if (sqlClient) {
    await ensurePg();
    const rows = orgId
      ? await sqlClient`select * from cases where case_number = ${caseNumber} and org_id = ${orgId} limit 1`
      : await sqlClient`select * from cases where case_number = ${caseNumber} limit 1`;
    const [row] = rows;
    return row ? normalizeCase(row) : null;
  }
  return memoryStore.cases.find((item) => item.case_number === caseNumber && (!orgId || item.org_id === orgId)) ?? null;
}

export async function getCaseByIdOrNumber(identifier: string, orgId?: string | null) {
  if (sqlClient) {
    await ensurePg();
    const rows = orgId
      ? await sqlClient`select * from cases where (id = ${identifier} or case_number = ${identifier}) and org_id = ${orgId} limit 1`
      : await sqlClient`select * from cases where id = ${identifier} or case_number = ${identifier} limit 1`;
    const [row] = rows;
    return row ? normalizeCase(row) : null;
  }
  return (
    memoryStore.cases.find((item) => (item.id === identifier || item.case_number === identifier) && (!orgId || item.org_id === orgId)) ??
    null
  );
}

export async function listCases(orgId: string) {
  if (sqlClient) {
    await ensurePg();
    const rows = await sqlClient`select * from cases where org_id = ${orgId} order by updated_at desc, created_at desc`;
    return rows.map(normalizeCase);
  }
  return memoryStore.cases
    .filter((item) => item.org_id === orgId)
    .sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at));
}

export async function updateCaseEvidence(caseNumber: string, evidence: ProcessedCaseState, orgId?: string | null) {
  const record = (await getCaseByNumber(caseNumber, orgId)) ?? (await seedCase(caseNumber));
  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      update cases
      set evidence_json = ${JSON.stringify(evidence)}::jsonb, status = 'processing', updated_at = now()
      where id = ${record.id}
      returning *
    `;
    return normalizeCase(row);
  }
  record.evidence_json = evidence;
  record.status = "processing";
  record.updated_at = nowIso();
  return record;
}

export async function createEvidenceItem(input: {
  caseId: string;
  orgId: string;
  type: EvidenceRecord["type"];
  title: string;
  sourceRef: string;
  content: unknown;
  status?: EvidenceRecord["status"];
  error?: string | null;
}) {
  const record: EvidenceRecord = {
    id: stableId("evidence"),
    case_id: input.caseId,
    org_id: input.orgId,
    type: input.type,
    title: input.title,
    source_ref: input.sourceRef,
    content: input.content,
    status: input.status ?? "uploaded",
    error: input.error ?? null,
    created_at: nowIso()
  };

  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      insert into evidence_items (id, case_id, org_id, type, title, source_ref, content, status, error, created_at)
      values (${record.id}, ${record.case_id}, ${record.org_id}, ${record.type}, ${record.title}, ${record.source_ref}, ${JSON.stringify(record.content)}::jsonb, ${record.status}, ${record.error}, ${record.created_at})
      returning *
    `;
    return normalizeEvidence(row);
  }

  memoryStore.evidence.push(record);
  return record;
}

export async function updateEvidenceStatus(evidenceId: string, status: EvidenceRecord["status"], error?: string | null) {
  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      update evidence_items set status = ${status}, error = ${error ?? null} where id = ${evidenceId} returning *
    `;
    return row ? normalizeEvidence(row) : null;
  }
  const record = memoryStore.evidence.find((item) => item.id === evidenceId);
  if (!record) return null;
  record.status = status;
  record.error = error ?? null;
  return record;
}

export async function listEvidenceForCase(caseId: string) {
  if (sqlClient) {
    await ensurePg();
    const rows = await sqlClient`select * from evidence_items where case_id = ${caseId} order by created_at asc`;
    return rows.map(normalizeEvidence);
  }
  return memoryStore.evidence.filter((item) => item.case_id === caseId).sort((a, b) => a.created_at.localeCompare(b.created_at));
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
  const previousDraft = report.human_edit ?? report.ai_draft;

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
      before: JSON.stringify(previousDraft),
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
    before: JSON.stringify(previousDraft),
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

export async function upsertPolicy(orgId: string, title: string, content: string, source = "manual") {
  const existing = memoryStore.policies.find((policy) => policy.org_id === orgId && policy.title === title);
  const record: PolicyRecord = {
    id: existing?.id ?? stableId("policy"),
    org_id: orgId,
    title,
    content,
    source,
    created_at: existing?.created_at ?? nowIso()
  };

  if (sqlClient) {
    await ensurePg();
    const [row] = await sqlClient`
      insert into policies (id, org_id, title, content, source, created_at)
      values (${record.id}, ${record.org_id}, ${record.title}, ${record.content}, ${record.source}, ${record.created_at})
      on conflict (id) do update set title = excluded.title, content = excluded.content, source = excluded.source
      returning *
    `;
    return normalizePolicy(row);
  }

  if (existing) Object.assign(existing, record);
  else memoryStore.policies.push(record);
  return record;
}

export async function listPolicies(orgId: string) {
  if (sqlClient) {
    await ensurePg();
    const rows = await sqlClient`select * from policies where org_id = ${orgId} order by created_at desc`;
    return rows.map(normalizePolicy);
  }
  return memoryStore.policies.filter((policy) => policy.org_id === orgId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function resetDemoData() {
  if (sqlClient) {
    await ensurePg();
    await sqlClient`delete from audit`;
    await sqlClient`delete from reports`;
    await sqlClient`delete from evidence_items where case_id in (select id from cases where case_number = ${DEMO_CASE_NUMBER})`;
    await sqlClient`delete from cases where case_number = ${DEMO_CASE_NUMBER}`;
  } else {
    memoryStore.audit.length = 0;
    memoryStore.reports.length = 0;
    memoryStore.evidence.length = 0;
    memoryStore.cases.length = 0;
  }
  return seedCase();
}

export async function resetOrganizationWorkspace(orgId: string) {
  if (sqlClient) {
    await ensurePg();
    await sqlClient.begin(async (sql) => {
      await sql`
        delete from audit
        where report_id in (
          select reports.id
          from reports
          join cases on cases.id = reports.case_id
          where cases.org_id = ${orgId}
        )
      `;
      await sql`
        delete from reports
        where case_id in (
          select id
          from cases
          where org_id = ${orgId}
        )
      `;
      await sql`delete from evidence_items where org_id = ${orgId}`;
      await sql`delete from policies where org_id = ${orgId}`;
      await sql`delete from cases where org_id = ${orgId}`;
    });
    return;
  }

  const caseIds = new Set(memoryStore.cases.filter((item) => item.org_id === orgId).map((item) => item.id));
  memoryStore.audit = memoryStore.audit.filter((entry) => !memoryStore.reports.some((report) => report.id === entry.report_id && caseIds.has(report.case_id)));
  memoryStore.reports = memoryStore.reports.filter((report) => !caseIds.has(report.case_id));
  memoryStore.evidence = memoryStore.evidence.filter((item) => item.org_id !== orgId);
  memoryStore.policies = memoryStore.policies.filter((item) => item.org_id !== orgId);
  memoryStore.cases = memoryStore.cases.filter((item) => item.org_id !== orgId);
}

export async function resetApplicationState() {
  if (sqlClient) {
    await ensurePg();
    await sqlClient.begin(async (sql) => {
      await sql`delete from audit`;
      await sql`delete from reports`;
      await sql`delete from evidence_items`;
      await sql`delete from policies`;
      await sql`delete from cases`;
      await sql`delete from sessions`;
      await sql`delete from memberships`;
      await sql`delete from organizations`;
      await sql`delete from users`;
    });
    return;
  }

  memoryStore.audit.length = 0;
  memoryStore.reports.length = 0;
  memoryStore.evidence.length = 0;
  memoryStore.policies.length = 0;
  memoryStore.cases.length = 0;
  memoryStore.sessions.length = 0;
  memoryStore.memberships.length = 0;
  memoryStore.organizations.length = 0;
  memoryStore.users.length = 0;
}

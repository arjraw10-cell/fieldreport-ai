export type EvidenceType = "bodycam" | "dispatch" | "officer-notes";

export type DemoUser = {
  name: string;
  role: "officer" | "supervisor";
  canReview: boolean;
  canEdit: boolean;
  canApprove: boolean;
};

export type TimelineEntry = {
  time: string;
  title: string;
  detail: string;
  source: EvidenceType;
  sourceRef: string;
};

export type Flag = {
  type: "contradiction" | "missing_info" | "policy";
  title: string;
  detail: string;
  evidenceRefs: string[];
};

export type ProcessedCaseState = {
  caseId: string;
  processedOrder: EvidenceType[];
  timeline: TimelineEntry[];
  facts: {
    suspect?: {
      name?: string;
      dob?: string;
      dl?: string;
    };
    vehicle?: {
      year?: string;
      make?: string;
      model?: string;
      color?: string;
      plate?: string;
    };
    sfst?: {
      hgn?: string;
      walkAndTurn?: string;
      oneLegStand?: string;
    };
    miranda?: {
      time?: string;
      officer?: string;
      suspectResponse?: string;
    };
    dispatch?: {
      incidentId?: string;
      callType?: string;
      address?: string;
      beat?: string;
      division?: string;
      unit?: string;
      officer?: string;
    };
    property?: {
      tow?: string;
      damageOwner?: string;
    };
    alcoholStatement?: string;
  };
  citations: Record<string, string>;
  contradictions: Flag[];
  missingInfo: Flag[];
};

export type DraftReport = {
  narrative: string;
  charges: string[];
  property: string;
  miranda_documentation: string;
  vehicle_description: string;
  citations: Array<{
    ref: string;
    source: string;
    text: string;
  }>;
  policy_compliance: string[];
  contradictions: Flag[];
  missing_info: Flag[];
  niaContext?: NiaContextResult[];
  niaContextUsed?: number;
};

export type NiaContextResult = {
  query: string;
  results: SearchResult[];
  tags?: string[];
};

export type SearchResult = {
  id: string;
  title: string;
  content: string;
  source: string;
  tags: string[];
  metadata: Record<string, unknown>;
  score: number;
};

export type CaseRecord = {
  id: string;
  org_id?: string | null;
  case_number: string;
  title?: string | null;
  incident_type: string;
  status: string;
  evidence_json: ProcessedCaseState | null;
  created_at: string;
  updated_at?: string;
};

export type ReportRecord = {
  id: string;
  case_id: string;
  version: number;
  ai_draft: DraftReport;
  human_edit: DraftReport | null;
  final: DraftReport | null;
  status: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
};

export type AuditRecord = {
  id: string;
  report_id: string;
  action: string;
  actor: string;
  field: string | null;
  before: string | null;
  after: string | null;
  evidence_ref: string | null;
  created_at: string;
};

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

export type OrganizationRecord = {
  id: string;
  name: string;
  created_at: string;
};

export type MembershipRecord = {
  id: string;
  user_id: string;
  org_id: string;
  role: "officer" | "supervisor" | "admin";
  created_at: string;
};

export type AuthUser = UserRecord & {
  org: OrganizationRecord;
  membership: MembershipRecord;
};

export type EvidenceRecord = {
  id: string;
  case_id: string;
  org_id: string;
  type: EvidenceType;
  title: string;
  source_ref: string;
  content: unknown;
  status: "uploaded" | "processed" | "failed";
  error: string | null;
  created_at: string;
};

export type PolicyRecord = {
  id: string;
  org_id: string;
  title: string;
  content: string;
  source: string;
  created_at: string;
};

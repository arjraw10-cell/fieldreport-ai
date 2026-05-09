import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const cases = pgTable("cases", {
  id: text("id").primaryKey(),
  case_number: text("case_number").notNull().unique(),
  incident_type: text("incident_type").notNull(),
  status: text("status").notNull(),
  evidence_json: jsonb("evidence_json"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  case_id: text("case_id")
    .notNull()
    .references(() => cases.id),
  version: integer("version").notNull(),
  ai_draft: jsonb("ai_draft").notNull(),
  human_edit: jsonb("human_edit"),
  final: jsonb("final"),
  status: text("status").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approved_by: text("approved_by"),
  approved_at: timestamp("approved_at", { withTimezone: true })
});

export const audit = pgTable("audit", {
  id: serial("id").primaryKey(),
  report_id: text("report_id")
    .notNull()
    .references(() => reports.id),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  field: text("field"),
  before: text("before"),
  after: text("after"),
  evidence_ref: text("evidence_ref"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

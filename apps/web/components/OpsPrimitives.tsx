"use client";

import Link from "next/link";
import type { ReactNode } from "react";

const statusTone: Record<string, string> = {
  open: "border-blue-200 bg-blue-50 text-blue-800",
  processing: "border-amber-200 bg-amber-50 text-amber-800",
  needs_review: "border-orange-200 bg-orange-50 text-orange-800",
  draft_ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  approved: "border-slate-200 bg-slate-100 text-slate-700",
  closed: "border-slate-200 bg-slate-100 text-slate-700",
  failed: "border-red-200 bg-red-50 text-red-800"
};

export function StatusBadge({ status }: { status?: string | null }) {
  const normalized = (status ?? "unknown").toLowerCase().replace(/\s+/g, "_");
  const tone = statusTone[normalized] ?? "border-ink/10 bg-white text-ink/70";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${tone}`}>{normalized.replace(/_/g, " ")}</span>;
}

export function ShellHeader({
  title,
  eyebrow,
  user,
  org,
  action,
  backHref,
  leftAction
}: {
  title: string;
  eyebrow: string;
  user?: string;
  org?: string;
  action?: ReactNode;
  backHref?: string;
  leftAction?: ReactNode;
}) {
  return (
    <header className="border-b border-ink/10 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {leftAction}
            {backHref && (
              <Link className="rounded-md border border-ink/15 px-2.5 py-1.5 text-sm font-bold text-ink hover:bg-ink hover:text-white" href={backHref}>
                Back
              </Link>
            )}
            <p className="text-xs font-black uppercase tracking-[0.22em] text-brass">{eyebrow}</p>
          </div>
          <h1 className="mt-1 truncate text-2xl font-black text-ink md:text-3xl">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(user || org) && (
            <div className="rounded-md border border-ink/10 bg-paper/70 px-3 py-2 text-right">
              <p className="text-sm font-bold text-ink">{user ?? "Signed in"}</p>
              {org && <p className="text-xs text-ink/55">{org}</p>}
            </div>
          )}
          {action}
        </div>
      </div>
    </header>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-ink/20 bg-white/75 p-8 text-center">
      <h2 className="text-lg font-black text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink/65">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const classes = {
    info: "border-slate-200 bg-white text-ink",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900"
  };
  return <div className={`rounded-md border px-4 py-3 text-sm font-semibold ${classes[tone]}`}>{children}</div>;
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-black uppercase tracking-[0.16em] text-ink/55">{children}</label>;
}

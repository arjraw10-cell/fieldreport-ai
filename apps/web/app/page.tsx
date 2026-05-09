"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEMO_CASE_NUMBER, DEMO_USERS } from "@/lib/demo";

export default function DashboardPage() {
  const [user, setUser] = useState("Officer Chen");

  useEffect(() => {
    setUser(localStorage.getItem("fieldreport-user") ?? "Officer Chen");
  }, []);

  function changeUser(nextUser: string) {
    setUser(nextUser);
    localStorage.setItem("fieldreport-user", nextUser);
  }

  return (
    <main className="min-h-screen bg-[#09111f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-[#f0b15c]/20 blur-3xl" />
        <div className="absolute bottom-[-14rem] right-[-8rem] h-[36rem] w-[36rem] rounded-full bg-[#4aa3a2]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-7xl content-center px-6 py-10">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/80">FieldReport AI</div>
          <label className="flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-white/45">User</span>
            <select className="bg-transparent text-sm font-bold text-white outline-none" value={user} onChange={(event) => changeUser(event.target.value)}>
              {DEMO_USERS.map((demoUser) => (
                <option key={demoUser.name} className="text-ink">
                  {demoUser.name}
                </option>
              ))}
            </select>
          </label>
        </header>

        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 text-xs font-black uppercase tracking-[0.34em] text-[#f0b15c]">Metro PD DUI demo</p>
            <h1 className="font-display text-6xl leading-[0.92] tracking-tight md:text-8xl">Turn evidence into a review-ready report.</h1>
            <p className="mt-7 max-w-2xl text-xl leading-8 text-white/68">
              FieldReport AI processes bodycam, dispatch, and officer notes into a cited DUI draft with flags, timeline, and approval audit.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                className="rounded-full bg-[#f0b15c] px-7 py-4 text-sm font-black uppercase tracking-wide text-[#09111f] shadow-[0_18px_40px_rgba(240,177,92,0.24)]"
                href="/demo"
              >
                Run the demo
              </Link>
              <Link className="rounded-full border border-white/20 px-7 py-4 text-sm font-bold text-white/85 hover:bg-white/10" href={`/review/${DEMO_CASE_NUMBER}`}>
                Open review
              </Link>
            </div>
          </div>

          <aside className="rounded-[2.25rem] border border-white/12 bg-white/[0.08] p-6 shadow-2xl backdrop-blur">
            <div className="rounded-[1.75rem] bg-[#f7efe2] p-6 text-[#111827]">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#9b5d19]">Active case</p>
              <h2 className="mt-3 font-display text-4xl">{DEMO_CASE_NUMBER}</h2>
              <p className="mt-2 text-sm text-[#111827]/60">DUI Arrest, Central Division, Beat 3A</p>
              <div className="mt-6 grid gap-3">
                {[
                  ["Evidence", "Bodycam, dispatch, officer notes"],
                  ["AI Draft", "Citations on every factual claim"],
                  ["Review", "Officer edit, supervisor approval"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-[#111827]/10 bg-white/70 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-[#9b5d19]">{label}</p>
                    <p className="mt-1 font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

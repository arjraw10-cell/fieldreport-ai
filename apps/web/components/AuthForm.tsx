"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

type AuthResponse = {
  error?: string;
  message?: string;
};

const copy = {
  login: {
    eyebrow: "Secure access",
    title: "Sign in to FieldReport AI",
    body: "Access your case queue, review packets, and grounded reports from one production workspace.",
    submit: "Sign in",
    loading: "Signing in...",
    switchLabel: "Need an account?",
    switchAction: "Create one",
    switchHref: "/signup",
    endpoint: "/api/auth/login"
  },
  signup: {
    eyebrow: "Create workspace access",
    title: "Start using FieldReport AI",
    body: "Create an account for evidence-backed incident drafting, review, and approval workflows.",
    submit: "Create account",
    loading: "Creating account...",
    switchLabel: "Already have an account?",
    switchAction: "Sign in",
    switchHref: "/login",
    endpoint: "/api/auth/signup"
  }
} satisfies Record<AuthMode, Record<string, string>>;

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const content = copy[mode];
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Enter an email address and password.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(content.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          name: name.trim(),
          organizationName: organizationName.trim()
        })
      });
      const json = (await response.json().catch(() => ({}))) as AuthResponse;

      if (!response.ok) {
        throw new Error(json.error ?? json.message ?? "Authentication failed.");
      }

      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-ink">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex min-h-[36rem] flex-col justify-between border-b border-ink/10 bg-[#09111f] px-6 py-8 text-white lg:border-b-0 lg:border-r lg:px-10">
          <Link className="w-fit rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/80 hover:bg-white/10" href="/">
            FieldReport AI
          </Link>

          <div className="max-w-xl py-16">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#f0b15c]">{content.eyebrow}</p>
            <h1 className="mt-5 font-display text-5xl leading-[0.95] tracking-tight md:text-6xl">{content.title}</h1>
            <p className="mt-6 text-lg leading-8 text-white/68">{content.body}</p>
          </div>

          <div className="grid gap-3 text-sm text-white/60 sm:grid-cols-3">
            {["Evidence grounded", "Audit ready", "Team review"].map((item) => (
              <div key={item} className="border-t border-white/12 pt-3 font-semibold">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center px-6 py-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brass">{mode === "login" ? "Welcome back" : "New account"}</p>
              <h2 className="mt-3 font-display text-4xl">{mode === "login" ? "Continue your review queue." : "Create your secure sign-in."}</h2>
            </div>

            <form className="space-y-5" onSubmit={submit}>
              {mode === "signup" && (
                <>
                  <label className="block">
                    <span className="text-sm font-bold text-ink/75">Full name</span>
                    <input
                      autoComplete="name"
                      className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/15"
                      disabled={loading}
                      name="name"
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Jordan Lee"
                      type="text"
                      value={name}
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-ink/75">Organization</span>
                    <input
                      autoComplete="organization"
                      className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/15"
                      disabled={loading}
                      name="organization"
                      onChange={(event) => setOrganizationName(event.target.value)}
                      placeholder="Metro Field Response"
                      type="text"
                      value={organizationName}
                    />
                  </label>
                </>
              )}

              <label className="block">
                <span className="text-sm font-bold text-ink/75">Email address</span>
                <input
                  autoComplete="email"
                  className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/15"
                  disabled={loading}
                  inputMode="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@agency.gov"
                  type="email"
                  value={email}
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-ink/75">Password</span>
                <input
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/15"
                  disabled={loading}
                  minLength={mode === "signup" ? 8 : undefined}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "signup" ? "Minimum 8 characters" : "Enter your password"}
                  type="password"
                  value={password}
                />
              </label>

              {mode === "signup" && (
                <label className="block">
                  <span className="text-sm font-bold text-ink/75">Confirm password</span>
                  <input
                    autoComplete="new-password"
                    className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/15"
                    disabled={loading}
                    minLength={8}
                    name="confirmPassword"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat password"
                    type="password"
                    value={confirmPassword}
                  />
                </label>
              )}

              {error && (
                <div className="rounded-xl border border-signal/20 bg-signal/10 px-4 py-3 text-sm font-semibold text-signal" role="alert">
                  {error}
                </div>
              )}

              <button
                className="w-full rounded-full bg-ink px-5 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-card transition hover:bg-slateblue disabled:cursor-wait disabled:opacity-60"
                disabled={loading}
                type="submit"
              >
                {loading ? content.loading : content.submit}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink/60">
              {content.switchLabel}{" "}
              <Link className="font-black text-slateblue underline-offset-4 hover:underline" href={content.switchHref}>
                {content.switchAction}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

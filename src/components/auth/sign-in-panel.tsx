"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInPanel({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(mode === "sign-in" ? "/api/auth/sign-in" : "/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Sign-in did not go through.");
      onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in did not go through.");
      setPending(false);
    }
  }

  const creating = mode === "sign-up";

  return (
    <div className="meridian-shell min-h-dvh text-[#f4efe6]">
      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-12 sm:px-6">
        <header>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[#e0c088] uppercase">Meridian</p>
          <h1 className="font-display mt-2 text-4xl tracking-tight text-[#f6f0e6]">
            {creating ? "Create your account" : "Sign in to the tree"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#9aa6b2]">
            {creating
              ? "Use your email and a password of at least 8 characters. After this, an invite link joins you to that campaign."
              : "The tech tree is for people on the team. Sign in with email and password. An invite link joins that campaign once you are in."}
          </p>
        </header>
        <form
          className="grid gap-4 rounded-lg border border-[#e0c088]/25 bg-[#071422]/80 p-4"
          data-testid="sign-in"
          onSubmit={(event) => void submit(event)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              placeholder="you@company.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={creating ? "new-password" : "current-password"}
              value={password}
              placeholder="At least 8 characters"
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-[#e07a5f]" data-testid="auth-error">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Working…" : creating ? "Create account" : "Sign in"}
          </Button>
          <button
            type="button"
            className="text-left text-sm text-[#e0c088] underline-offset-4 hover:underline"
            onClick={() => {
              setMode(creating ? "sign-in" : "sign-up");
              setError(null);
            }}
          >
            {creating ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </form>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { NameDialog } from "@/components/board/dialogs";
import { LIMITS, normalizeText, validateCampaignName } from "@/lib/board-model";
import {
  getDisplayName,
  getServerDisplayName,
  rememberDisplayName,
  subscribeDisplayName,
  useClientReady,
} from "@/lib/display-name";
import { rememberCampaign, type LocalCampaign } from "@/lib/local-campaigns";
import type { CampaignSummary } from "@/lib/types";

export function CampaignHome() {
  const router = useRouter();
  const clientReady = useClientReady();
  const displayName = useSyncExternalStore(subscribeDisplayName, getDisplayName, getServerDisplayName);
  const [session, setSession] = useState<"loading" | "guest" | "in">("loading");
  const [campaigns, setCampaigns] = useState<LocalCampaign[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [naming, setNaming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await response.json()) as { user?: { email: string } | null };
        if (cancelled) return;
        setSession(data.user ? "in" : "guest");
      } catch {
        if (!cancelled) setSession("guest");
      }
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (session !== "in") return;
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/campaigns", { cache: "no-store" });
        const data = (await response.json()) as { campaigns?: CampaignSummary[]; error?: string };
        if (!response.ok) {
          if (cancelled) return;
          setNotice(data.error || "The campaign list did not answer.");
          setCampaigns([]);
          setStatus("error");
          return;
        }
        if (cancelled) return;
        setNotice(null);
        setCampaigns((data.campaigns ?? []).map((item) => ({ id: item.id, name: item.name })));
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setNotice("The campaign list did not answer.");
        setCampaigns([]);
        setStatus("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    setCampaigns([]);
    setSession("guest");
  }

  if (session === "guest") {
    return <SignInPanel onSuccess={() => setSession("in")} />;
  }
  if (session === "loading") {
    return (
      <div className="meridian-shell flex min-h-dvh items-center justify-center text-sm text-[#9aa6b2]">
        Checking your sign-in…
      </div>
    );
  }

  async function create() {
    const message = validateCampaignName(name);
    if (message) {
      setError(message);
      return;
    }
    if (!displayName) {
      setNaming(true);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizeText(name), author: displayName }),
      });
      const data = (await response.json()) as CampaignSummary & { error?: string };
      if (!response.ok) throw new Error(data.error || "Couldn't create that campaign.");
      rememberCampaign({ id: data.id, name: data.name });
      router.push(`/c/${data.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't create that campaign.");
      setCreating(false);
    }
  }

  return (
    <div className="meridian-shell min-h-dvh text-[#f4efe6]">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header>
          <h1 className="font-display text-4xl tracking-tight text-[#f6f0e6]">Meridian</h1>
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="text-sm leading-relaxed text-[#9aa6b2]">
              Each campaign is one tech tree. Sign in, then open an invite link to join it. Only members can edit.
            </p>
            <Button variant="outline" size="sm" className="border-[#e0c088]/30 bg-[#0c1a2c]" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </header>

        <section className="grid gap-3" aria-label="Campaigns" data-testid="campaign-list">
          <h2 className="text-[11px] font-semibold tracking-[0.18em] text-[#e0c088] uppercase">Your campaigns</h2>
          {status === "loading" ? <p className="text-sm text-[#9aa6b2]">Opening the list…</p> : null}
          {notice ? (
            <p className="text-sm text-[#e07a5f]" data-testid="campaign-notice">
              {notice}
            </p>
          ) : null}
          {status !== "loading" && campaigns.length === 0 && !notice ? (
            <p className="text-sm text-[#9aa6b2]">No campaigns for this account yet. Create one, or open an invite link.</p>
          ) : null}
          <ul className="grid gap-2">
            {campaigns.map((campaign) => (
              <li
                key={campaign.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#e0c088]/25 bg-[#0c1a2c] px-3 py-3"
                data-testid="campaign-row"
              >
                <span className="font-display min-w-0 truncate text-xl text-[#f6f0e6]">{campaign.name}</span>
                <Button size="sm" onClick={() => router.push(`/c/${campaign.id}`)}>
                  Open
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <form
          className="grid gap-3 rounded-lg border border-[#e0c088]/25 bg-[#071422]/80 p-4"
          data-testid="new-campaign"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="campaign-name">New campaign</Label>
            <Input
              id="campaign-name"
              value={name}
              maxLength={LIMITS.campaignName}
              placeholder="Q3 launch"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-[#e07a5f]">{error}</p> : null}
          <Button type="submit" disabled={creating || !clientReady}>
            {creating ? "Creating…" : "Create campaign"}
          </Button>
        </form>
      </main>
      <NameDialog
        open={naming || (clientReady && !displayName)}
        required={!displayName}
        initialName={displayName ?? ""}
        onOpenChange={setNaming}
        onSave={(next) => {
          rememberDisplayName(next);
          setNaming(false);
        }}
      />
    </div>
  );
}

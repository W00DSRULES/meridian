"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NameDialog } from "@/components/board/dialogs";
import { LIMITS, normalizeText, validateCampaignName } from "@/lib/board-model";
import {
  getDisplayName,
  getServerDisplayName,
  rememberDisplayName,
  subscribeDisplayName,
  useClientReady,
} from "@/lib/display-name";
import {
  getLocalCampaigns,
  getServerLocalCampaigns,
  rememberCampaign,
  subscribeLocalCampaigns,
  type LocalCampaign,
} from "@/lib/local-campaigns";
import type { CampaignSummary } from "@/lib/types";

export function CampaignHome() {
  const router = useRouter();
  const clientReady = useClientReady();
  const displayName = useSyncExternalStore(subscribeDisplayName, getDisplayName, getServerDisplayName);
  const local = useSyncExternalStore(subscribeLocalCampaigns, getLocalCampaigns, getServerLocalCampaigns);
  const [campaigns, setCampaigns] = useState<LocalCampaign[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [naming, setNaming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/campaigns", { cache: "no-store" });
        const data = (await response.json()) as { campaigns?: CampaignSummary[]; error?: string };
        if (!response.ok) {
          if (cancelled) return;
          setNotice(data.error || "The campaign list did not answer.");
          setCampaigns(getLocalCampaigns());
          setStatus("error");
          return;
        }
        if (cancelled) return;
        setNotice(null);
        const remote = data.campaigns ?? [];
        let known = getLocalCampaigns();
        if (known.length === 0 && remote[0]) {
          rememberCampaign({ id: remote[0].id, name: remote[0].name });
          known = getLocalCampaigns();
        }
        const byId = new Map(remote.map((item) => [item.id, item]));
        const rows = known.map((item) => {
          const fresh = byId.get(item.id);
          return fresh ? { id: fresh.id, name: fresh.name } : item;
        });
        for (const row of rows) {
          if (row.name !== known.find((item) => item.id === row.id)?.name) rememberCampaign(row);
        }
        setCampaigns(rows);
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setNotice("The campaign list did not answer.");
        setCampaigns(getLocalCampaigns());
        setStatus("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [local]);

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
          <p className="mt-2 text-sm leading-relaxed text-[#9aa6b2]">
            Each campaign is one tech tree. People with the invite link edit it together.
          </p>
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
            <p className="text-sm text-[#9aa6b2]">No campaigns in this browser yet. Name one below.</p>
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

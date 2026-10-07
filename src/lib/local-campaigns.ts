"use client";

const KEY = "meridian-campaigns";

export type LocalCampaign = {
  id: string;
  name: string;
};

const listeners = new Set<() => void>();
const serverCampaigns: LocalCampaign[] = [];
let cached: LocalCampaign[] = [];
let loaded = false;

function readStored(): LocalCampaign[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as { id?: unknown; name?: unknown };
      if (typeof record.id !== "string" || typeof record.name !== "string") return [];
      const name = record.name.trim();
      if (!name) return [];
      return [{ id: record.id, name }];
    });
  } catch {
    return [];
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeLocalCampaigns(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLocalCampaigns(): LocalCampaign[] {
  if (!loaded) {
    loaded = true;
    cached = readStored();
  }
  return cached;
}

export function getServerLocalCampaigns(): LocalCampaign[] {
  return serverCampaigns;
}

export function rememberCampaign(campaign: LocalCampaign) {
  const current = getLocalCampaigns().filter((item) => item.id !== campaign.id);
  cached = [...current, campaign];
  loaded = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // The list still lives for this session if storage is blocked.
  }
  emit();
}

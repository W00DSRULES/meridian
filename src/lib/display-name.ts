"use client";

import { useSyncExternalStore } from "react";
import { LIMITS, normalizeText } from "@/lib/board-model";

const NAME_KEY = "meridian-display-name";

const listeners = new Set<() => void>();
let cached: string | null = null;
let loaded = false;

function readStoredName(): string | null {
  try {
    const stored = localStorage.getItem(NAME_KEY);
    if (!stored) return null;
    const name = normalizeText(stored);
    if (name.length === 0 || name.length > LIMITS.author) return null;
    return name;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeDisplayName(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== NAME_KEY) return;
    loaded = false;
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getDisplayName(): string | null {
  if (!loaded) {
    loaded = true;
    cached = readStoredName();
  }
  return cached;
}

export function getServerDisplayName(): null {
  return null;
}

export function rememberDisplayName(name: string): "stored" | "session" {
  cached = name;
  loaded = true;
  try {
    localStorage.setItem(NAME_KEY, name);
    emit();
    return "stored";
  } catch {
    emit();
    return "session";
  }
}

function subscribeClientReady() {
  return () => {};
}

export function useClientReady() {
  return useSyncExternalStore(subscribeClientReady, () => true, () => false);
}

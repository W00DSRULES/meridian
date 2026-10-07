import type { Commitment, Glyph, Proficiency } from "@/lib/types";
import { GLYPHS } from "@/lib/types";

export const LIMITS = {
  title: 80,
  description: 280,
  detail: 900,
  milestoneName: 80,
  milestones: 12,
  author: 40,
  nodes: 300,
  edges: 600,
} as const;

export const NODE_WIDTH = 232;
export const PLAQUE_WIDTH = 210;
export const PLAQUE_HEIGHT = 64;
export const COLUMN_X = [48, 388, 728, 1068] as const;
export const BAND_WIDTH = PLAQUE_WIDTH;
export const BAND_OFFSET_X = Math.round((NODE_WIDTH - PLAQUE_WIDTH) / 2);
export const FIRST_NODE_Y = 128;
export const NODE_STEP_Y = 214;

export const COLUMNS = [
  {
    key: "foundations",
    numeral: "I",
    title: "Foundations",
    blurb: "What later work stands on",
  },
  {
    key: "practice",
    numeral: "II",
    title: "Practice",
    blurb: "How the work actually gets done",
  },
  {
    key: "reach",
    numeral: "III",
    title: "Reach",
    blurb: "Where it meets the customer",
  },
  {
    key: "horizon",
    numeral: "IV",
    title: "Horizon",
    blurb: "The natural thing after this",
  },
] as const;

export const PROFICIENCY_META: Record<
  Proficiency,
  { label: string; stripe: string; ink: string; hint: string }
> = {
  good: {
    label: "Good at",
    stripe: "#3cba9a",
    ink: "#b7f0df",
    hint: "The team can do this well",
  },
  bad: {
    label: "Bad at",
    stripe: "#e07a5f",
    ink: "#f8c7b8",
    hint: "This is a weak spot",
  },
  neutral: {
    label: "Neutral",
    stripe: "#93a0b5",
    ink: "#d5dbe6",
    hint: "Neither a strength nor a gap",
  },
};

export const COMMITMENT_META: Record<
  Commitment,
  { label: string; hint: string }
> = {
  doing: { label: "Doing now", hint: "Someone is on this" },
  not_doing: { label: "Not doing", hint: "Intentionally not in motion" },
  next: { label: "Next step", hint: "The natural thing to pick up" },
};

export function isProficiency(value: unknown): value is Proficiency {
  return value === "good" || value === "bad" || value === "neutral";
}

export function isCommitment(value: unknown): value is Commitment {
  return value === "doing" || value === "not_doing" || value === "next";
}

export function isGlyph(value: unknown): value is Glyph {
  return typeof value === "string" && (GLYPHS as readonly string[]).includes(value);
}

export function glyphForIndex(index: number): Glyph {
  return GLYPHS[((index % GLYPHS.length) + GLYPHS.length) % GLYPHS.length];
}

export function normalizeText(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeDetail(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function milestoneCounts(milestones: { done: boolean }[]): { done: number; total: number } {
  const total = milestones.length;
  const done = milestones.reduce((count, milestone) => count + (milestone.done ? 1 : 0), 0);
  return { done, total };
}

export function validateIdentity(author: string): string | null {
  const name = normalizeText(author);
  if (name.length === 0) return "Add your name before changing the board.";
  if (name.length > LIMITS.author) return "Names stay under 40 characters.";
  return null;
}

export function validateCapability(input: {
  title: string;
  description: string;
  author: string;
}): string | null {
  const nameError = validateIdentity(input.author);
  if (nameError) return nameError;
  const title = normalizeText(input.title);
  const description = normalizeText(input.description);
  if (title.length === 0) return "Give this capability a title.";
  if (title.length > LIMITS.title) return "Titles stay under 80 characters.";
  if (description.length > LIMITS.description) {
    return "Subtitles stay under 280 characters.";
  }
  return null;
}

export function validateDetail(detail: string): string | null {
  if (normalizeDetail(detail).length > LIMITS.detail) {
    return "Descriptions stay under 900 characters.";
  }
  return null;
}

export function validateMilestoneName(name: string): string | null {
  const cleaned = normalizeText(name);
  if (cleaned.length === 0) return "Name this milestone.";
  if (cleaned.length > LIMITS.milestoneName) return "Milestone names stay under 80 characters.";
  return null;
}

export function nearestColumnIndex(x: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  COLUMN_X.forEach((columnX, index) => {
    const distance = Math.abs(x - columnX);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export function snapX(x: number): number {
  return COLUMN_X[nearestColumnIndex(x)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

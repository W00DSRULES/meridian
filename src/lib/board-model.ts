import type { Commitment, Glyph, Proficiency } from "@/lib/types";
import { GLYPHS } from "@/lib/types";

export const LIMITS = {
  title: 80,
  description: 280,
  detail: 900,
  milestoneName: 80,
  milestones: 12,
  author: 40,
  eraName: 24,
  eras: 8,
  campaignName: 48,
  nodes: 300,
  edges: 600,
} as const;

export const NODE_WIDTH = 308;
export const PLAQUE_WIDTH = NODE_WIDTH;
export const PLAQUE_HEIGHT = 40;
export const COLUMN_GAP = 48;

export function columnX(index: number): number {
  return 8 + index * (NODE_WIDTH + COLUMN_GAP);
}

export const COLUMN_X = [columnX(0), columnX(1), columnX(2), columnX(3)] as const;
export const BAND_WIDTH = PLAQUE_WIDTH;
export const BAND_OFFSET_X = 0;
export const FIRST_NODE_Y = 56;
export const NODE_STEP_Y = 56;

export const DEFAULT_ERAS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "MVP" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Traction" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Scale" },
  { id: "44444444-4444-4444-8444-444444444444", name: "Horizon" },
] as const;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;

export function roman(index: number): string {
  return ROMAN[index] ?? String(index + 1);
}

export const PROFICIENCY_MARK: Record<Proficiency, string> = {
  good: "🔥",
  bad: "🫠",
  neutral: "🤷",
};

export const PROFICIENCY_CAPTION: Record<Proficiency, string> = {
  good: "Good at this",
  bad: "Weak here",
  neutral: "Neutral",
};

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

type Rgb = [number, number, number];

const PAINT_STOPS: { t: number; frame: Rgb; wash: Rgb }[] = [
  { t: 0, frame: [42, 46, 54], wash: [12, 14, 18] },
  { t: 0.2, frame: [64, 104, 148], wash: [28, 52, 82] },
  { t: 0.5, frame: [142, 198, 236], wash: [48, 96, 140] },
  { t: 0.82, frame: [86, 196, 164], wash: [28, 92, 74] },
  { t: 1, frame: [54, 196, 108], wash: [24, 110, 62] },
];

function lerpChannel(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function lerpRgb(start: Rgb, end: Rgb, amount: number): Rgb {
  return [
    lerpChannel(start[0], end[0], amount),
    lerpChannel(start[1], end[1], amount),
    lerpChannel(start[2], end[2], amount),
  ];
}

function rgb([red, green, blue]: Rgb, alpha?: number) {
  const channels = `${Math.round(red)} ${Math.round(green)} ${Math.round(blue)}`;
  if (alpha === undefined) return `rgb(${channels})`;
  return `rgb(${channels} / ${alpha})`;
}

export type ProgressPaint = {
  frame: string;
  wash: string;
  glow: string;
  ink: string;
  fraction: number;
};

export function progressPaint(done: number, total: number): ProgressPaint {
  const fraction = total <= 0 || done <= 0 ? 0 : Math.min(1, done / total);
  let start = PAINT_STOPS[0];
  let end = PAINT_STOPS[PAINT_STOPS.length - 1];
  for (let index = 0; index < PAINT_STOPS.length - 1; index += 1) {
    const left = PAINT_STOPS[index];
    const right = PAINT_STOPS[index + 1];
    if (fraction >= left.t && fraction <= right.t) {
      start = left;
      end = right;
      break;
    }
  }
  const span = end.t - start.t || 1;
  const local = (fraction - start.t) / span;
  const frame = lerpRgb(start.frame, end.frame, local);
  const wash = lerpRgb(start.wash, end.wash, local);
  const ink = fraction === 0 ? ([168, 176, 188] as Rgb) : lerpRgb(frame, [244, 250, 255], 0.42);
  return {
    frame: rgb(frame),
    wash: rgb(wash),
    glow: fraction === 0 ? "transparent" : rgb(frame, 0.2 + fraction * 0.5),
    ink: rgb(ink),
    fraction,
  };
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

export function validateCampaignName(name: string): string | null {
  const cleaned = normalizeText(name);
  if (cleaned.length === 0) return "Name this campaign.";
  if (cleaned.length > LIMITS.campaignName) return "Campaign names stay under 48 characters.";
  return null;
}

export function validateEraName(name: string): string | null {
  const cleaned = normalizeText(name);
  if (cleaned.length === 0) return "Name this era.";
  if (cleaned.length > LIMITS.eraName) return "Era names stay under 24 characters.";
  return null;
}

export function nearestColumnIndex(x: number, count: number = COLUMN_X.length): number {
  const columns = Math.max(1, count);
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < columns; index += 1) {
    const distance = Math.abs(x - columnX(index));
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

export function snapX(x: number, count: number = COLUMN_X.length): number {
  return columnX(nearestColumnIndex(x, count));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

import { COLUMN_X, FIRST_NODE_Y, NODE_STEP_Y } from "@/lib/board-model";
import type { Commitment, Glyph, Proficiency } from "@/lib/types";

export type ExampleMilestone = { name: string; done: boolean };

export type ExampleNode = {
  title: string;
  description: string;
  detail: string;
  glyph: Glyph;
  proficiency: Proficiency;
  commitment: Commitment;
  author: string;
  x: number;
  y: number;
  milestones: ExampleMilestone[];
};

export const EXAMPLE_NODES: ExampleNode[] = [
  {
    title: "Discovery calls",
    description: "The first conversation that decides if a lead is real.",
    detail:
      "These calls are how the team learns whether a problem is real before anyone builds a deck. A good one ends with a named buyer, a reason to meet again, and notes the rest of the team can trust.",
    glyph: "compass",
    proficiency: "good",
    commitment: "doing",
    author: "Priya Shah",
    x: COLUMN_X[0],
    y: FIRST_NODE_Y,
    milestones: [
      { name: "Open with their last quarter", done: true },
      { name: "Name the economic buyer", done: true },
      { name: "Book the follow-up before hanging up", done: true },
      { name: "Log the call the same day", done: false },
      { name: "Share one useful artifact", done: false },
    ],
  },
  {
    title: "Renewal forecast",
    description: "A shared view of which accounts are likely to renew.",
    detail:
      "The forecast is a single list the team argues about in the open, not a slide that appears the week before the quarter ends. Each risk account needs an owner and a date.",
    glyph: "beacon",
    proficiency: "neutral",
    commitment: "doing",
    author: "Priya Shah",
    x: COLUMN_X[0],
    y: FIRST_NODE_Y + NODE_STEP_Y,
    milestones: [
      { name: "Pull usage for the quarter", done: true },
      { name: "Flag the risk accounts", done: true },
      { name: "Name an owner for each risk", done: false },
      { name: "Set the next review date", done: false },
    ],
  },
  {
    title: "Qualified pipeline",
    description: "A lead the team agrees is worth a demo.",
    detail:
      "A lead only counts once sales and engineering agree a demo is worth the room. The checklist is the bar. If a box is empty, it is not qualified yet.",
    glyph: "lens",
    proficiency: "bad",
    commitment: "doing",
    author: "Elena Voss",
    x: COLUMN_X[1],
    y: FIRST_NODE_Y,
    milestones: [
      { name: "Budget named", done: true },
      { name: "Timeline the buyer will defend", done: false },
      { name: "Champion who replies", done: false },
      { name: "Competition written down", done: false },
      { name: "Mutual plan agreed", done: false },
    ],
  },
  {
    title: "Demo environment",
    description: "A stable place to show the product without engineering on the call.",
    detail:
      "Sales should be able to open a known login, walk the happy path, and reset the data before the next call. Engineering should not have to babysit the room.",
    glyph: "lantern",
    proficiency: "bad",
    commitment: "not_doing",
    author: "Elena Voss",
    x: COLUMN_X[1],
    y: FIRST_NODE_Y + NODE_STEP_Y,
    milestones: [
      { name: "Sample company loaded", done: true },
      { name: "Login sales can share", done: true },
      { name: "Happy path scripted", done: false },
      { name: "Reset between calls", done: false },
    ],
  },
  {
    title: "Handoff notes",
    description: "What sales promised, written so engineering can deliver it.",
    detail:
      "The handoff is the bridge. It should sound like the customer, name who signs, and list what was actually promised, including the risks still open.",
    glyph: "quill",
    proficiency: "neutral",
    commitment: "next",
    author: "Jonah Adeyemi",
    x: COLUMN_X[2],
    y: FIRST_NODE_Y,
    milestones: [
      { name: "Problem in their words", done: false },
      { name: "Who signs", done: false },
      { name: "What was promised", done: false },
      { name: "Risks still open", done: false },
    ],
  },
  {
    title: "Expansion review",
    description: "A check on accounts that are ready for a second offer.",
    detail:
      "Expansion is a review, not a hope. The team looks at accounts already succeeding and decides whether a second offer is honest.",
    glyph: "sprout",
    proficiency: "neutral",
    commitment: "not_doing",
    author: "Priya Shah",
    x: COLUMN_X[3],
    y: FIRST_NODE_Y,
    milestones: [
      { name: "Accounts past first value", done: true },
      { name: "Second offer drafted", done: false },
      { name: "Owner for the conversation", done: false },
    ],
  },
];

export const EXAMPLE_LINKS: [string, string][] = [
  ["Discovery calls", "Qualified pipeline"],
  ["Renewal forecast", "Qualified pipeline"],
  ["Qualified pipeline", "Handoff notes"],
  ["Demo environment", "Handoff notes"],
  ["Handoff notes", "Expansion review"],
];

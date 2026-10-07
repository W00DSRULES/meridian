export const PROFICIENCIES = ["good", "bad", "neutral"] as const;
export const COMMITMENTS = ["doing", "not_doing", "next"] as const;
export const GLYPHS = ["compass", "quill", "lantern", "lens", "sprout", "beacon", "keystone", "anchor"] as const;

export type Proficiency = (typeof PROFICIENCIES)[number];
export type Commitment = (typeof COMMITMENTS)[number];
export type Glyph = (typeof GLYPHS)[number];

export type Milestone = {
  id: string;
  name: string;
  done: boolean;
  position: number;
};

export type BoardEra = {
  id: string;
  name: string;
  position: number;
};

export type BoardNode = {
  id: string;
  title: string;
  description: string;
  detail: string;
  glyph: Glyph;
  proficiency: Proficiency;
  commitment: Commitment;
  eraId: string;
  author: string;
  x: number;
  y: number;
  createdAt: number;
  updatedAt: number;
  milestones: Milestone[];
};

export type BoardEdge = {
  id: string;
  source: string;
  target: string;
  author: string;
  createdAt: number;
};

export type BoardSnapshot = {
  revision: number;
  nodes: BoardNode[];
  edges: BoardEdge[];
  eras: BoardEra[];
  unchanged?: boolean;
  focusId?: string;
};

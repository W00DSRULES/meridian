export const PROFICIENCIES = ["good", "bad", "neutral"] as const;
export const COMMITMENTS = ["doing", "not_doing", "next"] as const;

export type Proficiency = (typeof PROFICIENCIES)[number];
export type Commitment = (typeof COMMITMENTS)[number];

export type BoardNode = {
  id: string;
  title: string;
  description: string;
  proficiency: Proficiency;
  commitment: Commitment;
  author: string;
  x: number;
  y: number;
  createdAt: number;
  updatedAt: number;
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
  unchanged?: boolean;
  focusId?: string;
};

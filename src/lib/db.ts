import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import {
  COLUMN_X,
  FIRST_NODE_Y,
  LIMITS,
  NODE_STEP_Y,
  clamp,
  isCommitment,
  isProficiency,
  nearestColumnIndex,
  normalizeText,
  snapX,
  validateCapability,
  validateIdentity,
} from "@/lib/board-model";
import type {
  BoardEdge,
  BoardNode,
  BoardSnapshot,
  Commitment,
  Proficiency,
} from "@/lib/types";

const ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NodeRow = {
  id: string;
  title: string;
  description: string;
  proficiency: string;
  commitment: string;
  author: string;
  x: number;
  y: number;
  created_at: number;
  updated_at: number;
};

type EdgeRow = {
  id: string;
  source: string;
  target: string;
  author: string;
  created_at: number;
};

export class BoardRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BoardRequestError";
    this.status = status;
  }
}

const globalForDb = globalThis as unknown as {
  __meridianDb?: Database.Database;
};

function openDb(): Database.Database {
  if (globalForDb.__meridianDb) return globalForDb.__meridianDb;

  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "board.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO meta (key, value) VALUES ('revision', 0);

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      proficiency TEXT NOT NULL,
      commitment TEXT NOT NULL,
      author TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (source) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target) REFERENCES nodes(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS edges_pair ON edges(source, target);
  `);
  globalForDb.__meridianDb = db;
  return db;
}

function revisionOf(db: Database.Database): number {
  const row = db
    .prepare("SELECT value FROM meta WHERE key = 'revision'")
    .get() as { value: number };
  return row.value;
}

function bump(db: Database.Database): void {
  db.prepare("UPDATE meta SET value = value + 1 WHERE key = 'revision'").run();
}

function mapNode(row: NodeRow): BoardNode {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    proficiency: row.proficiency as Proficiency,
    commitment: row.commitment as Commitment,
    author: row.author,
    x: row.x,
    y: row.y,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEdge(row: EdgeRow): BoardEdge {
  return {
    id: row.id,
    source: row.source,
    target: row.target,
    author: row.author,
    createdAt: row.created_at,
  };
}

export function readBoard(): BoardSnapshot {
  const db = openDb();
  const nodes = db
    .prepare("SELECT * FROM nodes ORDER BY created_at ASC")
    .all() as NodeRow[];
  const edges = db
    .prepare("SELECT * FROM edges ORDER BY created_at ASC")
    .all() as EdgeRow[];
  return {
    revision: revisionOf(db),
    nodes: nodes.map(mapNode),
    edges: edges.map(mapEdge),
  };
}

function requireId(id: string): string {
  if (!ID_RE.test(id)) {
    throw new BoardRequestError(400, "That board item isn't recognized.");
  }
  return id;
}

function requireAuthor(value: unknown): string {
  if (typeof value !== "string") {
    throw new BoardRequestError(400, "Add your name before changing the board.");
  }
  const message = validateIdentity(value);
  if (message) throw new BoardRequestError(400, message);
  return normalizeText(value);
}

function requirePosition(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BoardRequestError(400, `That ${label} isn't usable.`);
  }
  const rounded = Math.round(value * 100) / 100;
  return label === "column" ? clamp(rounded, -400, 5000) : clamp(rounded, -400, 8000);
}

function nextSlot(db: Database.Database): { x: number; y: number } {
  const rows = db.prepare("SELECT x, y FROM nodes").all() as { x: number; y: number }[];
  const counts = [0, 0, 0, 0];
  for (const row of rows) counts[nearestColumnIndex(row.x)] += 1;
  let column = 0;
  for (let index = 1; index < counts.length; index += 1) {
    if (counts[index] < counts[column]) column = index;
  }
  return {
    x: COLUMN_X[column],
    y: FIRST_NODE_Y + counts[column] * NODE_STEP_Y,
  };
}

type NodeWrite = {
  title?: string;
  description?: string;
  proficiency?: Proficiency;
  commitment?: Commitment;
  author: string;
  x?: number;
  y?: number;
};

function parseNodeWrite(body: unknown, partial: boolean): NodeWrite {
  if (!body || typeof body !== "object") {
    throw new BoardRequestError(400, "That request was empty.");
  }
  const record = body as Record<string, unknown>;
  const author = requireAuthor(record.author);
  const next: NodeWrite = { author };

  const touchesContent =
    record.title !== undefined ||
    record.description !== undefined ||
    record.proficiency !== undefined ||
    record.commitment !== undefined;
  const touchesPosition = record.x !== undefined || record.y !== undefined;
  if (partial && !touchesContent && !touchesPosition) {
    throw new BoardRequestError(400, "Nothing on that capability changed.");
  }

  if (!partial || record.title !== undefined || record.description !== undefined) {
    if ((!partial || record.title !== undefined) && typeof record.title !== "string") {
      throw new BoardRequestError(400, "Give this capability a title.");
    }
    if (record.description !== undefined && typeof record.description !== "string") {
      throw new BoardRequestError(400, "The description needs to be text.");
    }
    const title = typeof record.title === "string" ? record.title : "";
    const description = typeof record.description === "string" ? record.description : "";
    if (!partial || record.title !== undefined) {
      const message = validateCapability({ title, description, author });
      if (message) throw new BoardRequestError(400, message);
      next.title = normalizeText(title);
      if (record.description !== undefined || !partial) {
        next.description = normalizeText(description);
      }
    } else if (record.description !== undefined) {
      const cleaned = normalizeText(description);
      if (cleaned.length > LIMITS.description) {
        throw new BoardRequestError(400, "Descriptions stay under 280 characters.");
      }
      next.description = cleaned;
    }
  }

  if (!partial || record.proficiency !== undefined) {
    if (!isProficiency(record.proficiency)) {
      throw new BoardRequestError(400, "Pick good at, bad at, or neutral.");
    }
    next.proficiency = record.proficiency;
  }

  if (!partial || record.commitment !== undefined) {
    if (!isCommitment(record.commitment)) {
      throw new BoardRequestError(400, "Pick doing now, not doing, or next step.");
    }
    next.commitment = record.commitment;
  }

  if (record.x !== undefined) next.x = snapX(requirePosition(record.x, "column"));
  if (record.y !== undefined) next.y = requirePosition(record.y, "row");

  return next;
}

export function createNode(body: unknown): BoardSnapshot {
  const input = parseNodeWrite(body, false);
  if (
    input.title === undefined ||
    input.description === undefined ||
    input.proficiency === undefined ||
    input.commitment === undefined
  ) {
    throw new BoardRequestError(400, "Give this capability a title.");
  }
  const db = openDb();
  let focusId = "";
  const run = db.transaction(() => {
    const count = db.prepare("SELECT COUNT(*) AS count FROM nodes").get() as { count: number };
    if (count.count >= LIMITS.nodes) {
      throw new BoardRequestError(400, "This board is full. Remove a capability before adding another.");
    }
    const slot = nextSlot(db);
    const x = input.x ?? slot.x;
    const y = input.y ?? slot.y;
    focusId = crypto.randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO nodes (id, title, description, proficiency, commitment, author, x, y, created_at, updated_at)
       VALUES (@id, @title, @description, @proficiency, @commitment, @author, @x, @y, @created_at, @updated_at)`,
    ).run({
      id: focusId,
      title: input.title,
      description: input.description,
      proficiency: input.proficiency,
      commitment: input.commitment,
      author: input.author,
      x: snapX(x),
      y,
      created_at: now,
      updated_at: now,
    });
    bump(db);
  });
  run();
  return { ...readBoard(), focusId };
}

export function updateNode(id: string, body: unknown): BoardSnapshot {
  const nodeId = requireId(id);
  const input = parseNodeWrite(body, true);
  const db = openDb();
  const run = db.transaction(() => {
    const existing = db.prepare("SELECT * FROM nodes WHERE id = ?").get(nodeId) as NodeRow | undefined;
    if (!existing) {
      throw new BoardRequestError(404, "That capability is no longer on the board.");
    }
    const now = Date.now();
    db.prepare(
      `UPDATE nodes SET
        title = @title,
        description = @description,
        proficiency = @proficiency,
        commitment = @commitment,
        author = @author,
        x = @x,
        y = @y,
        updated_at = @updated_at
       WHERE id = @id`,
    ).run({
      id: nodeId,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      proficiency: input.proficiency ?? existing.proficiency,
      commitment: input.commitment ?? existing.commitment,
      author: input.author,
      x: input.x ?? existing.x,
      y: input.y ?? existing.y,
      updated_at: now,
    });
    bump(db);
  });
  run();
  return readBoard();
}

export function deleteNode(id: string): BoardSnapshot {
  const nodeId = requireId(id);
  const db = openDb();
  const run = db.transaction(() => {
    const result = db.prepare("DELETE FROM nodes WHERE id = ?").run(nodeId);
    if (result.changes === 0) {
      throw new BoardRequestError(404, "That capability is no longer on the board.");
    }
    bump(db);
  });
  run();
  return readBoard();
}

export function createEdge(body: unknown): BoardSnapshot {
  if (!body || typeof body !== "object") {
    throw new BoardRequestError(400, "That request was empty.");
  }
  const record = body as Record<string, unknown>;
  const author = requireAuthor(record.author);
  if (typeof record.source !== "string" || typeof record.target !== "string") {
    throw new BoardRequestError(400, "Pick two capabilities to connect.");
  }
  const source = requireId(record.source);
  const target = requireId(record.target);
  if (source === target) {
    throw new BoardRequestError(400, "A capability can't lead to itself.");
  }
  const db = openDb();
  const run = db.transaction(() => {
    const count = db.prepare("SELECT COUNT(*) AS count FROM edges").get() as { count: number };
    if (count.count >= LIMITS.edges) {
      throw new BoardRequestError(400, "This board has enough links. Remove one before adding another.");
    }
    const sourceRow = db.prepare("SELECT id FROM nodes WHERE id = ?").get(source);
    const targetRow = db.prepare("SELECT id FROM nodes WHERE id = ?").get(target);
    if (!sourceRow || !targetRow) {
      throw new BoardRequestError(404, "One of those capabilities is no longer on the board.");
    }
    const duplicate = db
      .prepare("SELECT id FROM edges WHERE source = ? AND target = ?")
      .get(source, target);
    if (duplicate) {
      throw new BoardRequestError(409, "Those two are already linked that way.");
    }
    db.prepare(
      `INSERT INTO edges (id, source, target, author, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), source, target, author, Date.now());
    bump(db);
  });
  run();
  return readBoard();
}

export function deleteEdge(id: string): BoardSnapshot {
  const edgeId = requireId(id);
  const db = openDb();
  const run = db.transaction(() => {
    const result = db.prepare("DELETE FROM edges WHERE id = ?").run(edgeId);
    if (result.changes === 0) {
      throw new BoardRequestError(404, "That link is already gone.");
    }
    bump(db);
  });
  run();
  return readBoard();
}

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { EXAMPLE_LINKS, EXAMPLE_NODES } from "@/lib/examples";
import {
  COLUMN_X,
  DEFAULT_ERAS,
  FIRST_NODE_Y,
  LIMITS,
  NODE_STEP_Y,
  clamp,
  columnX,
  glyphForIndex,
  isCommitment,
  isGlyph,
  isProficiency,
  nearestColumnIndex,
  normalizeDetail,
  normalizeText,
  snapX,
  validateCapability,
  validateDetail,
  validateEraName,
  validateIdentity,
  validateMilestoneName,
} from "@/lib/board-model";
import type {
  BoardEdge,
  BoardEra,
  BoardNode,
  BoardSnapshot,
  Commitment,
  Glyph,
  Milestone,
  Proficiency,
} from "@/lib/types";

const ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NodeRow = {
  id: string;
  title: string;
  description: string;
  detail: string;
  glyph: string;
  proficiency: string;
  commitment: string;
  author: string;
  era_id: string | null;
  x: number;
  y: number;
  created_at: number;
  updated_at: number;
};

type MilestoneRow = {
  id: string;
  node_id: string;
  name: string;
  done: number;
  position: number;
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

let boardReady = false;

function openDb(): Database.Database {
  if (globalForDb.__meridianDb) {
    ensureReady(globalForDb.__meridianDb);
    return globalForDb.__meridianDb;
  }

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
    INSERT OR IGNORE INTO meta (key, value) VALUES ('content_version', 0);
    INSERT OR IGNORE INTO meta (key, value) VALUES ('layout_version', 0);

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
  ensureReady(db);
  return db;
}

function ensureReady(db: Database.Database): void {
  if (boardReady) return;
  migrate(db);
  boardReady = true;
}

function columnNames(db: Database.Database, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

function metaValue(db: Database.Database, key: string): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: number } | undefined;
  return row?.value ?? 0;
}

function migrate(db: Database.Database): void {
  const nodeColumns = columnNames(db, "nodes");
  if (!nodeColumns.has("detail")) {
    db.exec("ALTER TABLE nodes ADD COLUMN detail TEXT NOT NULL DEFAULT ''");
  }
  if (!nodeColumns.has("glyph")) {
    db.exec("ALTER TABLE nodes ADD COLUMN glyph TEXT NOT NULL DEFAULT 'compass'");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      name TEXT NOT NULL,
      done INTEGER NOT NULL,
      position INTEGER NOT NULL,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS milestones_node ON milestones(node_id, position);
  `);
  if (!columnNames(db, "nodes").has("era_id")) {
    db.exec("ALTER TABLE nodes ADD COLUMN era_id TEXT");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS eras (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position INTEGER NOT NULL
    );
  `);
  const seed = db.transaction(() => {
    if (metaValue(db, "content_version") < 1) {
      const count = db.prepare("SELECT COUNT(*) AS count FROM nodes").get() as { count: number };
      if (count.count === 0) insertExamples(db);
      else backfillExamples(db);
      db.prepare(
        "INSERT INTO meta (key, value) VALUES ('content_version', 1) ON CONFLICT(key) DO UPDATE SET value = 1",
      ).run();
    }
    if (metaValue(db, "layout_version") < 5) {
      restackColumns(db);
      db.prepare(
        "INSERT INTO meta (key, value) VALUES ('layout_version', 5) ON CONFLICT(key) DO UPDATE SET value = 5",
      ).run();
      bump(db);
    }
    const eraCount = db.prepare("SELECT COUNT(*) AS count FROM eras").get() as { count: number };
    if (eraCount.count === 0) {
      const insertEra = db.prepare("INSERT INTO eras (id, name, position) VALUES (?, ?, ?)");
      DEFAULT_ERAS.forEach((era, index) => insertEra.run(era.id, era.name, index));
      const nodes = db.prepare("SELECT id, x FROM nodes").all() as { id: string; x: number }[];
      const assign = db.prepare("UPDATE nodes SET era_id = ? WHERE id = ?");
      for (const node of nodes) {
        const index = nearestColumnIndex(node.x, DEFAULT_ERAS.length);
        assign.run(DEFAULT_ERAS[index].id, node.id);
      }
      placeByEra(db);
      bump(db);
    }
  });
  seed();
}

function insertMilestoneRows(
  db: Database.Database,
  nodeId: string,
  milestones: { name: string; done: boolean }[],
): void {
  const insert = db.prepare(
    `INSERT INTO milestones (id, node_id, name, done, position) VALUES (?, ?, ?, ?, ?)`,
  );
  milestones.forEach((milestone, index) => {
    insert.run(crypto.randomUUID(), nodeId, milestone.name, milestone.done ? 1 : 0, index);
  });
}

function insertExamples(db: Database.Database): void {
  const now = Date.now();
  const insertNode = db.prepare(
    `INSERT INTO nodes (
      id, title, description, detail, glyph, proficiency, commitment, author, x, y, created_at, updated_at
    ) VALUES (
      @id, @title, @description, @detail, @glyph, @proficiency, @commitment, @author, @x, @y, @created_at, @updated_at
    )`,
  );
  const ids = new Map<string, string>();
  for (const example of EXAMPLE_NODES) {
    const id = crypto.randomUUID();
    ids.set(example.title, id);
    insertNode.run({
      id,
      title: example.title,
      description: example.description,
      detail: example.detail,
      glyph: example.glyph,
      proficiency: example.proficiency,
      commitment: example.commitment,
      author: example.author,
      x: example.x,
      y: example.y,
      created_at: now,
      updated_at: now,
    });
    insertMilestoneRows(db, id, example.milestones);
  }
  const insertEdge = db.prepare(
    `INSERT INTO edges (id, source, target, author, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const [sourceTitle, targetTitle] of EXAMPLE_LINKS) {
    const source = ids.get(sourceTitle);
    const target = ids.get(targetTitle);
    if (!source || !target) continue;
    insertEdge.run(crypto.randomUUID(), source, target, "Priya Shah", now);
  }
}

function backfillExamples(db: Database.Database): void {
  const update = db.prepare(
    `UPDATE nodes SET detail = CASE WHEN detail = '' THEN @detail ELSE detail END, glyph = @glyph WHERE id = @id`,
  );
  for (const example of EXAMPLE_NODES) {
    const row = db.prepare("SELECT id FROM nodes WHERE title = ?").get(example.title) as { id: string } | undefined;
    if (!row) continue;
    update.run({ id: row.id, detail: example.detail, glyph: example.glyph });
    const existing = db.prepare("SELECT COUNT(*) AS count FROM milestones WHERE node_id = ?").get(row.id) as {
      count: number;
    };
    if (existing.count === 0) insertMilestoneRows(db, row.id, example.milestones);
  }
}

function restackColumns(db: Database.Database): void {
  const rows = db.prepare("SELECT id, x, y FROM nodes").all() as { id: string; x: number; y: number }[];
  const columns = new Map<number, { id: string; y: number }[]>();
  for (const row of rows) {
    const column = nearestColumnIndex(row.x, COLUMN_X.length);
    const list = columns.get(column) ?? [];
    list.push(row);
    columns.set(column, list);
  }
  const update = db.prepare("UPDATE nodes SET x = ?, y = ? WHERE id = ?");
  for (const [column, list] of columns) {
    list.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
    list.forEach((node, index) => {
      update.run(COLUMN_X[column], FIRST_NODE_Y + index * NODE_STEP_Y, node.id);
    });
  }
}

function listEras(db: Database.Database): BoardEra[] {
  return db
    .prepare("SELECT id, name, position FROM eras ORDER BY position ASC, id ASC")
    .all() as BoardEra[];
}

function placeByEra(db: Database.Database): void {
  const eras = listEras(db);
  if (eras.length === 0) return;
  const nodes = db.prepare("SELECT id, era_id, y FROM nodes").all() as {
    id: string;
    era_id: string | null;
    y: number;
  }[];
  const update = db.prepare("UPDATE nodes SET era_id = ?, x = ?, y = ? WHERE id = ?");
  eras.forEach((era, column) => {
    const members = nodes
      .filter((node) => node.era_id === era.id)
      .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
    members.forEach((node, index) => {
      update.run(era.id, columnX(column), FIRST_NODE_Y + index * NODE_STEP_Y, node.id);
    });
  });
  const known = new Set(eras.map((era) => era.id));
  const loose = nodes
    .filter((node) => !node.era_id || !known.has(node.era_id))
    .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  const first = eras[0];
  const used = nodes.filter((node) => node.era_id === first.id).length;
  loose.forEach((node, index) => {
    update.run(first.id, columnX(0), FIRST_NODE_Y + (used + index) * NODE_STEP_Y, node.id);
  });
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

function mapNode(row: NodeRow, milestones: Milestone[]): BoardNode {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    detail: row.detail ?? "",
    glyph: isGlyph(row.glyph) ? row.glyph : "compass",
    proficiency: row.proficiency as Proficiency,
    commitment: row.commitment as Commitment,
    eraId: row.era_id ?? DEFAULT_ERAS[0].id,
    author: row.author,
    x: row.x,
    y: row.y,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    milestones,
  };
}

function milestonesByNode(db: Database.Database): Map<string, Milestone[]> {
  const rows = db
    .prepare("SELECT id, node_id, name, done, position FROM milestones ORDER BY position ASC, id ASC")
    .all() as MilestoneRow[];
  const grouped = new Map<string, Milestone[]>();
  for (const row of rows) {
    const list = grouped.get(row.node_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      done: row.done === 1,
      position: row.position,
    });
    grouped.set(row.node_id, list);
  }
  return grouped;
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
  const milestones = milestonesByNode(db);
  const nodes = db
    .prepare("SELECT * FROM nodes ORDER BY created_at ASC")
    .all() as NodeRow[];
  const edges = db
    .prepare("SELECT * FROM edges ORDER BY created_at ASC")
    .all() as EdgeRow[];
  return {
    revision: revisionOf(db),
    nodes: nodes.map((row) => mapNode(row, milestones.get(row.id) ?? [])),
    edges: edges.map(mapEdge),
    eras: listEras(db),
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

function nextSlot(db: Database.Database, eraId?: string): { x: number; y: number; eraId: string } {
  const eras = listEras(db);
  const rows = db.prepare("SELECT era_id FROM nodes").all() as { era_id: string | null }[];
  const counts = new Map(eras.map((era) => [era.id, 0]));
  for (const row of rows) {
    if (row.era_id && counts.has(row.era_id)) counts.set(row.era_id, (counts.get(row.era_id) ?? 0) + 1);
  }
  let chosen = eras.find((era) => era.id === eraId) ?? eras[0];
  if (!eraId) {
    for (const era of eras) {
      if ((counts.get(era.id) ?? 0) < (counts.get(chosen.id) ?? 0)) chosen = era;
    }
  }
  const count = counts.get(chosen.id) ?? 0;
  return {
    x: columnX(chosen.position),
    y: FIRST_NODE_Y + count * NODE_STEP_Y,
    eraId: chosen.id,
  };
}

type NodeWrite = {
  title?: string;
  description?: string;
  detail?: string;
  glyph?: Glyph;
  proficiency?: Proficiency;
  commitment?: Commitment;
  author: string;
  eraId?: string;
  x?: number;
  y?: number;
};

function parseMilestoneDrafts(value: unknown): { name: string; done: boolean }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new BoardRequestError(400, "Milestones need to be a list.");
  }
  if (value.length > LIMITS.milestones) {
    throw new BoardRequestError(400, `A card can hold ${LIMITS.milestones} milestones.`);
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new BoardRequestError(400, "Name this milestone.");
    }
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string") {
      throw new BoardRequestError(400, "Name this milestone.");
    }
    const message = validateMilestoneName(record.name);
    if (message) throw new BoardRequestError(400, message);
    return { name: normalizeText(record.name), done: record.done === true };
  });
}

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
    record.detail !== undefined ||
    record.glyph !== undefined ||
    record.proficiency !== undefined ||
    record.commitment !== undefined;
  const touchesPosition = record.x !== undefined || record.y !== undefined || record.eraId !== undefined;
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

  if (record.detail !== undefined) {
    if (typeof record.detail !== "string") {
      throw new BoardRequestError(400, "The description needs to be text.");
    }
    const message = validateDetail(record.detail);
    if (message) throw new BoardRequestError(400, message);
    next.detail = normalizeDetail(record.detail);
  }

  if (record.glyph !== undefined) {
    if (!isGlyph(record.glyph)) {
      throw new BoardRequestError(400, "That icon isn't on the board.");
    }
    next.glyph = record.glyph;
  }

  if (!partial || record.proficiency !== undefined) {
    if (!isProficiency(record.proficiency)) {
      throw new BoardRequestError(400, "Pick how the team reads this.");
    }
    next.proficiency = record.proficiency;
  }

  if (!partial || record.commitment !== undefined) {
    if (!isCommitment(record.commitment)) {
      throw new BoardRequestError(400, "Pick doing now, not doing, or next step.");
    }
    next.commitment = record.commitment;
  }

  if (typeof record.eraId === "string") next.eraId = requireId(record.eraId);
  if (record.x !== undefined) next.x = requirePosition(record.x, "column");
  if (record.y !== undefined) next.y = requirePosition(record.y, "row");

  return next;
}

export function createNode(body: unknown): BoardSnapshot {
  const input = parseNodeWrite(body, false);
  const milestones = parseMilestoneDrafts(
    body && typeof body === "object" ? (body as Record<string, unknown>).milestones : undefined,
  );
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
    const slot = nextSlot(db, input.eraId);
    const eras = listEras(db);
    const era = eras.find((item) => item.id === slot.eraId) ?? eras[0];
    const x = input.eraId ? slot.x : snapX(input.x ?? slot.x, eras.length);
    const column = nearestColumnIndex(x, eras.length);
    const eraId = input.eraId ? slot.eraId : (eras[column]?.id ?? era.id);
    const y = input.y ?? slot.y;
    focusId = crypto.randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO nodes (
        id, title, description, detail, glyph, proficiency, commitment, author, era_id, x, y, created_at, updated_at
      ) VALUES (
        @id, @title, @description, @detail, @glyph, @proficiency, @commitment, @author, @era_id, @x, @y, @created_at, @updated_at
      )`,
    ).run({
      id: focusId,
      title: input.title,
      description: input.description,
      detail: input.detail ?? "",
      glyph: input.glyph ?? glyphForIndex(count.count),
      proficiency: input.proficiency,
      commitment: input.commitment,
      author: input.author,
      era_id: eraId,
      x: columnX(Math.max(0, eras.findIndex((item) => item.id === eraId))),
      y,
      created_at: now,
      updated_at: now,
    });
    insertMilestoneRows(db, focusId, milestones);
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
    const eras = listEras(db);
    let eraId = input.eraId ?? existing.era_id ?? eras[0]?.id;
    let x = input.x ?? existing.x;
    let y = input.y ?? existing.y;
    if (input.eraId && input.eraId !== existing.era_id) {
      const era = eras.find((item) => item.id === input.eraId);
      if (!era) throw new BoardRequestError(400, "That era isn't on the board.");
      const siblings = db
        .prepare("SELECT COUNT(*) AS count FROM nodes WHERE era_id = ? AND id != ?")
        .get(era.id, nodeId) as { count: number };
      eraId = era.id;
      x = columnX(Math.max(0, eras.findIndex((item) => item.id === era.id)));
      y = FIRST_NODE_Y + siblings.count * NODE_STEP_Y;
    } else if (input.x !== undefined) {
      const index = nearestColumnIndex(input.x, eras.length);
      const era = eras[index];
      if (era) {
        eraId = era.id;
        x = columnX(index);
      }
    }
    const now = Date.now();
    db.prepare(
      `UPDATE nodes SET
        title = @title,
        description = @description,
        detail = @detail,
        glyph = @glyph,
        proficiency = @proficiency,
        commitment = @commitment,
        author = @author,
        era_id = @era_id,
        x = @x,
        y = @y,
        updated_at = @updated_at
       WHERE id = @id`,
    ).run({
      id: nodeId,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      detail: input.detail ?? existing.detail,
      glyph: input.glyph ?? existing.glyph,
      proficiency: input.proficiency ?? existing.proficiency,
      commitment: input.commitment ?? existing.commitment,
      author: input.author,
      era_id: eraId,
      x,
      y,
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

export function createEra(body: unknown): BoardSnapshot {
  if (!body || typeof body !== "object") {
    throw new BoardRequestError(400, "That request was empty.");
  }
  const record = body as Record<string, unknown>;
  requireAuthor(record.author);
  const db = openDb();
  const run = db.transaction(() => {
    const eras = listEras(db);
    if (eras.length >= LIMITS.eras) {
      throw new BoardRequestError(400, "The board already has as many eras as it can hold.");
    }
    const requested = typeof record.name === "string" ? record.name : "New era";
    let name = normalizeText(requested) || "New era";
    const message = validateEraName(name);
    if (message) throw new BoardRequestError(400, message);
    const taken = new Set(eras.map((era) => era.name.toLowerCase()));
    if (taken.has(name.toLowerCase())) {
      let suffix = 2;
      while (taken.has(`${name} ${suffix}`.toLowerCase()) && suffix < 20) suffix += 1;
      name = `${name} ${suffix}`;
    }
    db.prepare("INSERT INTO eras (id, name, position) VALUES (?, ?, ?)").run(
      crypto.randomUUID(),
      name,
      eras.length,
    );
    bump(db);
  });
  run();
  return readBoard();
}

export function updateEra(id: string, body: unknown): BoardSnapshot {
  const eraId = requireId(id);
  if (!body || typeof body !== "object") {
    throw new BoardRequestError(400, "That request was empty.");
  }
  const record = body as Record<string, unknown>;
  requireAuthor(record.author);
  const db = openDb();
  const run = db.transaction(() => {
    const eras = listEras(db);
    const index = eras.findIndex((era) => era.id === eraId);
    if (index < 0) throw new BoardRequestError(404, "That era is no longer on the board.");
    if (typeof record.name === "string") {
      const message = validateEraName(record.name);
      if (message) throw new BoardRequestError(400, message);
      db.prepare("UPDATE eras SET name = ? WHERE id = ?").run(normalizeText(record.name), eraId);
    }
    if (record.direction === -1 || record.direction === 1) {
      const next = index + record.direction;
      if (next >= 0 && next < eras.length) {
        const other = eras[next];
        const current = eras[index];
        const swap = db.prepare("UPDATE eras SET position = ? WHERE id = ?");
        swap.run(other.position, current.id);
        swap.run(current.position, other.id);
        placeByEra(db);
      }
    }
    bump(db);
  });
  run();
  return readBoard();
}

function touchNode(db: Database.Database, nodeId: string, author: string): void {
  db.prepare("UPDATE nodes SET author = ?, updated_at = ? WHERE id = ?").run(author, Date.now(), nodeId);
}

export function createMilestone(nodeId: string, body: unknown): BoardSnapshot {
  const id = requireId(nodeId);
  if (!body || typeof body !== "object") {
    throw new BoardRequestError(400, "That request was empty.");
  }
  const record = body as Record<string, unknown>;
  const author = requireAuthor(record.author);
  if (typeof record.name !== "string") {
    throw new BoardRequestError(400, "Name this milestone.");
  }
  const message = validateMilestoneName(record.name);
  if (message) throw new BoardRequestError(400, message);
  const name = normalizeText(record.name);
  const done = record.done === true;
  const db = openDb();
  const run = db.transaction(() => {
    const node = db.prepare("SELECT id FROM nodes WHERE id = ?").get(id);
    if (!node) throw new BoardRequestError(404, "That capability is no longer on the board.");
    const count = db.prepare("SELECT COUNT(*) AS count FROM milestones WHERE node_id = ?").get(id) as {
      count: number;
    };
    if (count.count >= LIMITS.milestones) {
      throw new BoardRequestError(400, `A card can hold ${LIMITS.milestones} milestones.`);
    }
    const last = db.prepare("SELECT MAX(position) AS max FROM milestones WHERE node_id = ?").get(id) as {
      max: number | null;
    };
    db.prepare(
      `INSERT INTO milestones (id, node_id, name, done, position) VALUES (?, ?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), id, name, done ? 1 : 0, (last.max ?? -1) + 1);
    touchNode(db, id, author);
    bump(db);
  });
  run();
  return readBoard();
}

export function updateMilestone(nodeId: string, milestoneId: string, body: unknown): BoardSnapshot {
  const ownerId = requireId(nodeId);
  const id = requireId(milestoneId);
  if (!body || typeof body !== "object") {
    throw new BoardRequestError(400, "That request was empty.");
  }
  const record = body as Record<string, unknown>;
  const author = requireAuthor(record.author);
  const hasName = record.name !== undefined;
  const hasDone = record.done !== undefined;
  if (!hasName && !hasDone) {
    throw new BoardRequestError(400, "Nothing on that milestone changed.");
  }
  let name: string | undefined;
  if (hasName) {
    if (typeof record.name !== "string") throw new BoardRequestError(400, "Name this milestone.");
    const message = validateMilestoneName(record.name);
    if (message) throw new BoardRequestError(400, message);
    name = normalizeText(record.name);
  }
  if (hasDone && typeof record.done !== "boolean") {
    throw new BoardRequestError(400, "Mark the milestone done or not done.");
  }
  const db = openDb();
  const run = db.transaction(() => {
    const existing = db
      .prepare("SELECT id, name, done FROM milestones WHERE id = ? AND node_id = ?")
      .get(id, ownerId) as { id: string; name: string; done: number } | undefined;
    if (!existing) throw new BoardRequestError(404, "That milestone is no longer on the card.");
    db.prepare("UPDATE milestones SET name = ?, done = ? WHERE id = ?").run(
      name ?? existing.name,
      hasDone ? (record.done ? 1 : 0) : existing.done,
      id,
    );
    touchNode(db, ownerId, author);
    bump(db);
  });
  run();
  return readBoard();
}

export function deleteMilestone(nodeId: string, milestoneId: string, body: unknown): BoardSnapshot {
  const ownerId = requireId(nodeId);
  const id = requireId(milestoneId);
  if (!body || typeof body !== "object") {
    throw new BoardRequestError(400, "That request was empty.");
  }
  const author = requireAuthor((body as Record<string, unknown>).author);
  const db = openDb();
  const run = db.transaction(() => {
    const result = db.prepare("DELETE FROM milestones WHERE id = ? AND node_id = ?").run(id, ownerId);
    if (result.changes === 0) {
      throw new BoardRequestError(404, "That milestone is no longer on the card.");
    }
    touchNode(db, ownerId, author);
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

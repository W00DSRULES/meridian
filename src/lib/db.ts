import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EXAMPLE_LINKS, EXAMPLE_NODES } from "@/lib/examples";
import {
  DEFAULT_ERAS,
  FIRST_NODE_Y,
  LIMITS,
  NODE_STEP_Y,
  columnX,
  glyphForIndex,
  isCommitment,
  isGlyph,
  isProficiency,
  nearestColumnIndex,
  normalizeDetail,
  normalizeText,
  validateCampaignName,
  validateCapability,
  validateDetail,
  validateEraName,
  validateIdentity,
  validateMilestoneName,
} from "@/lib/board-model";
import type {
  BoardEdge,
  BoardNode,
  BoardSnapshot,
  CampaignSummary,
  Commitment,
  Glyph,
  Proficiency,
} from "@/lib/types";

export const EXAMPLE_CAMPAIGN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class BoardRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BoardRequestError";
    this.status = status;
  }
}

type CampaignRow = {
  id: string;
  name: string;
  revision: number;
  created_at: number;
  updated_at: number;
};

type EraRow = { id: string; name: string; position: number; campaign_id: string };

type TechRow = {
  id: string;
  campaign_id: string;
  era_id: string | null;
  title: string;
  description: string;
  detail: string;
  glyph: string;
  proficiency: string;
  commitment: string;
  author: string;
  x: number;
  y: number;
  created_at: number;
  updated_at: number;
  milestones?: MilestoneRow[];
};

type MilestoneRow = {
  id: string;
  tech_id: string;
  name: string;
  done: boolean;
  position: number;
};

type LinkRow = {
  id: string;
  campaign_id: string;
  source: string;
  target: string;
  author: string;
  created_at: number;
};

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

const globalForSb = globalThis as unknown as { __meridianSb?: SupabaseClient };

function configuredClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new BoardRequestError(
      503,
      "Supabase isn't configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  if (!globalForSb.__meridianSb) {
    globalForSb.__meridianSb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return globalForSb.__meridianSb;
}

export const CARD_CONFLICT = "Someone else changed this card. Reload it, then apply your draft again.";

function fail(error: { message?: string; code?: string }): never {
  const message = error.message ?? "";
  if (error.code === "23505") {
    throw new BoardRequestError(409, "That record is already on the campaign.");
  }
  if (/members/i.test(message) && /does not exist|schema cache|PGRST205|Could not find the table/i.test(message)) {
    throw new BoardRequestError(
      503,
      "Membership isn't in Supabase yet. Run supabase/membership.sql in the SQL editor.",
    );
  }
  if (/relation .* does not exist|Could not find the table|schema cache|PGRST205/i.test(message)) {
    throw new BoardRequestError(
      503,
      "The Meridian tables aren't in Supabase yet. Run supabase/schema.sql in the SQL editor.",
    );
  }
  if (/fetch failed|network|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(message)) {
    throw new BoardRequestError(
      502,
      "Supabase didn't answer. Check SUPABASE_URL and that this machine can reach it.",
    );
  }
  throw new BoardRequestError(502, "Supabase didn't answer. Check SUPABASE_URL and that this machine can reach it.");
}

export function requireCampaignId(value: string | null): string {
  if (!value || !ID_RE.test(value)) {
    throw new BoardRequestError(400, "Pick a campaign first.");
  }
  return value;
}

function requireId(id: string): string {
  if (!ID_RE.test(id)) throw new BoardRequestError(400, "That board item isn't recognized.");
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
  return Math.round(value * 100) / 100;
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function flag(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function mapCampaign(row: CampaignRow): CampaignSummary {
  return { id: row.id, name: row.name, createdAt: num(row.created_at), updatedAt: num(row.updated_at) };
}

function mapTech(row: TechRow): BoardNode {
  const milestones = [...(row.milestones ?? [])].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
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
    x: num(row.x),
    y: num(row.y),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
    milestones: milestones.map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      done: flag(milestone.done),
      position: num(milestone.position),
    })),
  };
}

function mapLink(row: LinkRow): BoardEdge {
  return {
    id: row.id,
    source: row.source,
    target: row.target,
    author: row.author,
    createdAt: num(row.created_at),
  };
}

let seedTask: Promise<void> | null = null;

async function seedExample(client: SupabaseClient): Promise<void> {
  const countResult = await client.from("campaigns").select("id", { count: "exact", head: true });
  if (countResult.error) fail(countResult.error);
  if ((countResult.count ?? 0) > 0) return;

  const now = Date.now();
  const created = await client.from("campaigns").insert({
    id: EXAMPLE_CAMPAIGN_ID,
    name: "Example tree",
    revision: 1,
    created_at: now,
    updated_at: now,
  });
  if (created.error) {
    if (created.error.code === "23505") return;
    fail(created.error);
  }

  const eras = await client.from("eras").insert(
    DEFAULT_ERAS.map((era, index) => ({
      id: era.id,
      campaign_id: EXAMPLE_CAMPAIGN_ID,
      name: era.name,
      position: index,
    })),
  );
  if (eras.error) {
    await client.from("campaigns").delete().eq("id", EXAMPLE_CAMPAIGN_ID);
    fail(eras.error);
  }

  const ids = new Map<string, string>();
  const techRows = EXAMPLE_NODES.map((example, index) => {
    const id = crypto.randomUUID();
    ids.set(example.title, id);
    const era = DEFAULT_ERAS[Math.min(3, Math.round((example.x - 8) / (308 + 48)))] ?? DEFAULT_ERAS[0];
    return {
      id,
      campaign_id: EXAMPLE_CAMPAIGN_ID,
      era_id: era.id,
      title: example.title,
      description: example.description,
      detail: example.detail,
      glyph: example.glyph,
      proficiency: example.proficiency,
      commitment: example.commitment,
      author: example.author,
      x: example.x,
      y: example.y,
      created_at: now + index,
      updated_at: now + index,
      milestones: example.milestones,
    };
  });

  const techs = await client.from("techs").insert(
    techRows.map((tech) => ({
      id: tech.id,
      campaign_id: tech.campaign_id,
      era_id: tech.era_id,
      title: tech.title,
      description: tech.description,
      detail: tech.detail,
      glyph: tech.glyph,
      proficiency: tech.proficiency,
      commitment: tech.commitment,
      author: tech.author,
      x: tech.x,
      y: tech.y,
      created_at: tech.created_at,
      updated_at: tech.updated_at,
    })),
  );
  if (techs.error) {
    await client.from("campaigns").delete().eq("id", EXAMPLE_CAMPAIGN_ID);
    fail(techs.error);
  }

  const milestoneRows = techRows.flatMap((tech) =>
    tech.milestones.map((milestone, index) => ({
      id: crypto.randomUUID(),
      tech_id: tech.id,
      name: milestone.name,
      done: milestone.done,
      position: index,
    })),
  );
  if (milestoneRows.length > 0) {
    const milestones = await client.from("milestones").insert(milestoneRows);
    if (milestones.error) {
      await client.from("campaigns").delete().eq("id", EXAMPLE_CAMPAIGN_ID);
      fail(milestones.error);
    }
  }

  const linkRows = EXAMPLE_LINKS.flatMap(([sourceTitle, targetTitle]) => {
    const source = ids.get(sourceTitle);
    const target = ids.get(targetTitle);
    if (!source || !target) return [];
    return [
      {
        id: crypto.randomUUID(),
        campaign_id: EXAMPLE_CAMPAIGN_ID,
        source,
        target,
        author: "Priya Shah",
        created_at: now,
      },
    ];
  });
  if (linkRows.length > 0) {
    const links = await client.from("links").insert(linkRows);
    if (links.error) {
      await client.from("campaigns").delete().eq("id", EXAMPLE_CAMPAIGN_ID);
      fail(links.error);
    }
  }
}

function ensureExample(client: SupabaseClient): Promise<void> {
  if (!seedTask) {
    seedTask = seedExample(client).catch((error: unknown) => {
      seedTask = null;
      throw error;
    });
  }
  return seedTask;
}

async function bump(client: SupabaseClient, campaignId: string): Promise<void> {
  const result = await client.rpc("bump_campaign", { campaign: campaignId });
  if (result.error) fail(result.error);
}

async function campaignRow(client: SupabaseClient, campaignId: string): Promise<CampaignRow> {
  const id = requireCampaignId(campaignId);
  const result = await client.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (result.error) fail(result.error);
  if (!result.data) throw new BoardRequestError(404, "That campaign isn't on this board.");
  return result.data as CampaignRow;
}

async function listEraRows(client: SupabaseClient, campaignId: string): Promise<EraRow[]> {
  const result = await client
    .from("eras")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true });
  if (result.error) fail(result.error);
  return (result.data ?? []) as EraRow[];
}

async function listTechRows(client: SupabaseClient, campaignId: string): Promise<TechRow[]> {
  const result = await client
    .from("techs")
    .select("*, milestones(*)")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (result.error) fail(result.error);
  return (result.data ?? []) as TechRow[];
}

function seenUpdatedAt(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>).updatedAt;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function requireClientRevision(body: unknown): number {
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
  const value = (body as Record<string, unknown>).revision;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new BoardRequestError(400, "Send the campaign revision with this save.");
  }
  return value;
}

export async function assertCardFresh(campaignId: string, techId: string, body: unknown): Promise<void> {
  const revision = requireClientRevision(body);
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  if (revision === num(campaign.revision)) return;
  const tech = await techInCampaign(client, campaign.id, requireId(techId));
  const seen = seenUpdatedAt(body);
  if (seen !== null && seen === num(tech.updated_at)) return;
  throw new BoardRequestError(409, CARD_CONFLICT);
}

async function claimTech(
  client: SupabaseClient,
  techId: string,
  author: string,
  seen: number | null,
): Promise<void> {
  let query = client.from("techs").update({ author, updated_at: Date.now() }).eq("id", techId);
  if (seen !== null) query = query.eq("updated_at", seen);
  const result = await query.select("id");
  if (result.error) fail(result.error);
  if (!result.data || result.data.length === 0) {
    if (seen !== null) throw new BoardRequestError(409, CARD_CONFLICT);
    throw new BoardRequestError(404, "That capability is no longer on the board.");
  }
}

export async function listMemberCampaigns(userId: string): Promise<CampaignSummary[]> {
  const client = configuredClient();
  const members = await client
    .from("members")
    .select("campaign_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (members.error) fail(members.error);
  const ids = ((members.data ?? []) as { campaign_id: string }[]).map((row) => row.campaign_id);
  if (ids.length === 0) return [];
  const result = await client.from("campaigns").select("*").in("id", ids);
  if (result.error) fail(result.error);
  const byId = new Map(((result.data ?? []) as CampaignRow[]).map((row) => [row.id, mapCampaign(row)]));
  return ids.flatMap((id) => {
    const campaign = byId.get(id);
    return campaign ? [campaign] : [];
  });
}

export async function assertMember(userId: string, campaignId: string): Promise<void> {
  const client = configuredClient();
  const id = requireCampaignId(campaignId);
  const result = await client.from("members").select("user_id").eq("campaign_id", id).eq("user_id", userId).maybeSingle();
  if (result.error) fail(result.error);
  if (!result.data) {
    throw new BoardRequestError(403, "You are not on this campaign. Open the invite link while signed in to join it.");
  }
}

export async function joinCampaign(userId: string, campaignId: string): Promise<{ joined: boolean; role: string }> {
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  const existing = await client
    .from("members")
    .select("role")
    .eq("campaign_id", campaign.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) fail(existing.error);
  if (existing.data) return { joined: false, role: String((existing.data as { role: string }).role) };
  const inserted = await client.from("members").insert({
    campaign_id: campaign.id,
    user_id: userId,
    role: "member",
    created_at: Date.now(),
  });
  if (inserted.error) {
    if (inserted.error.code === "23505") return { joined: false, role: "member" };
    fail(inserted.error);
  }
  return { joined: true, role: "member" };
}

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const client = configuredClient();
  try {
    await ensureExample(client);
  } catch (error) {
    if (error instanceof BoardRequestError) throw error;
    throw new BoardRequestError(502, "Supabase didn't answer. Check SUPABASE_URL and that this machine can reach it.");
  }
  const result = await client.from("campaigns").select("*").order("created_at", { ascending: true });
  if (result.error) fail(result.error);
  return ((result.data ?? []) as CampaignRow[]).map(mapCampaign);
}

export async function createCampaign(body: unknown, ownerId?: string): Promise<CampaignSummary> {
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
  const record = body as Record<string, unknown>;
  requireAuthor(record.author);
  if (typeof record.name !== "string") throw new BoardRequestError(400, "Name this campaign.");
  const message = validateCampaignName(record.name);
  if (message) throw new BoardRequestError(400, message);
  const client = configuredClient();
  try {
    await ensureExample(client);
  } catch (error) {
    if (error instanceof BoardRequestError) throw error;
    throw new BoardRequestError(
      502,
      "Supabase didn't answer. Check SUPABASE_URL and that this machine can reach it.",
    );
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  const created = await client
    .from("campaigns")
    .insert({ id, name: normalizeText(record.name), revision: 1, created_at: now, updated_at: now })
    .select("*")
    .single();
  if (created.error) fail(created.error);
  const eras = await client.from("eras").insert(
    DEFAULT_ERAS.map((era, index) => ({
      id: crypto.randomUUID(),
      campaign_id: id,
      name: era.name,
      position: index,
    })),
  );
  if (eras.error) {
    await client.from("campaigns").delete().eq("id", id);
    fail(eras.error);
  }
  if (ownerId) {
    const member = await client.from("members").insert({
      campaign_id: id,
      user_id: ownerId,
      role: "owner",
      created_at: now,
    });
    if (member.error) {
      await client.from("campaigns").delete().eq("id", id);
      fail(member.error);
    }
  }
  return mapCampaign(created.data as CampaignRow);
}

export async function readBoard(campaignId: string): Promise<BoardSnapshot> {
  const client = configuredClient();
  try {
    await ensureExample(client);
  } catch (error) {
    if (error instanceof BoardRequestError) throw error;
    throw new BoardRequestError(502, "Supabase didn't answer. Check SUPABASE_URL and that this machine can reach it.");
  }
  const campaign = await campaignRow(client, campaignId);
  const [eras, techs, linksResult] = await Promise.all([
    listEraRows(client, campaign.id),
    listTechRows(client, campaign.id),
    client.from("links").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: true }),
  ]);
  if (linksResult.error) fail(linksResult.error);
  return {
    revision: num(campaign.revision),
    nodes: techs.map(mapTech),
    edges: ((linksResult.data ?? []) as LinkRow[]).map(mapLink),
    eras: eras.map((era) => ({ id: era.id, name: era.name, position: num(era.position) })),
    campaign: mapCampaign(campaign),
  };
}

function parseMilestoneDrafts(value: unknown): { name: string; done: boolean }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new BoardRequestError(400, "Milestones need to be a list.");
  if (value.length > LIMITS.milestones) {
    throw new BoardRequestError(400, `A card can hold ${LIMITS.milestones} milestones.`);
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new BoardRequestError(400, "Name this milestone.");
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string") throw new BoardRequestError(400, "Name this milestone.");
    const message = validateMilestoneName(record.name);
    if (message) throw new BoardRequestError(400, message);
    return { name: normalizeText(record.name), done: record.done === true };
  });
}

function parseNodeWrite(body: unknown, partial: boolean): NodeWrite {
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
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
      if (record.description !== undefined || !partial) next.description = normalizeText(description);
    } else if (record.description !== undefined) {
      const cleaned = normalizeText(description);
      if (cleaned.length > LIMITS.description) {
        throw new BoardRequestError(400, "Descriptions stay under 280 characters.");
      }
      next.description = cleaned;
    }
  }
  if (record.detail !== undefined) {
    if (typeof record.detail !== "string") throw new BoardRequestError(400, "The description needs to be text.");
    const message = validateDetail(record.detail);
    if (message) throw new BoardRequestError(400, message);
    next.detail = normalizeDetail(record.detail);
  }
  if (record.glyph !== undefined) {
    if (!isGlyph(record.glyph)) throw new BoardRequestError(400, "That icon isn't on the board.");
    next.glyph = record.glyph;
  }
  if (!partial || record.proficiency !== undefined) {
    if (!isProficiency(record.proficiency)) throw new BoardRequestError(400, "Pick how the team reads this.");
    next.proficiency = record.proficiency;
  }
  if (!partial || record.commitment !== undefined) {
    if (!isCommitment(record.commitment)) throw new BoardRequestError(400, "Pick doing now, not doing, or next step.");
    next.commitment = record.commitment;
  }
  if (typeof record.eraId === "string") next.eraId = requireId(record.eraId);
  if (record.x !== undefined) next.x = requirePosition(record.x, "column");
  if (record.y !== undefined) next.y = requirePosition(record.y, "row");
  return next;
}

async function techInCampaign(client: SupabaseClient, campaignId: string, techId: string): Promise<TechRow> {
  const result = await client
    .from("techs")
    .select("*, milestones(*)")
    .eq("id", techId)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (result.error) fail(result.error);
  if (!result.data) throw new BoardRequestError(404, "That capability is no longer on the board.");
  return result.data as TechRow;
}

export async function createNode(campaignId: string, body: unknown): Promise<BoardSnapshot> {
  const input = parseNodeWrite(body, false);
  const milestones = parseMilestoneDrafts(
    body && typeof body === "object" ? (body as Record<string, unknown>).milestones : undefined,
  );
  if (!input.title || input.proficiency === undefined || input.commitment === undefined) {
    throw new BoardRequestError(400, "Give this capability a title.");
  }
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  const eras = await listEraRows(client, campaign.id);
  const techs = await listTechRows(client, campaign.id);
  if (techs.length >= LIMITS.nodes) {
    throw new BoardRequestError(400, "This board is full. Remove a capability before adding another.");
  }
  const era = eras.find((item) => item.id === input.eraId) ?? eras[0];
  if (!era) throw new BoardRequestError(400, "That era isn't on the board.");
  const siblings = techs.filter((tech) => tech.era_id === era.id).length;
  const column = Math.max(0, eras.findIndex((item) => item.id === era.id));
  const id = crypto.randomUUID();
  const now = Date.now();
  const inserted = await client.from("techs").insert({
    id,
    campaign_id: campaign.id,
    era_id: era.id,
    title: input.title,
    description: input.description ?? "",
    detail: input.detail ?? "",
    glyph: input.glyph ?? glyphForIndex(techs.length),
    proficiency: input.proficiency,
    commitment: input.commitment,
    author: input.author,
    x: columnX(column),
    y: FIRST_NODE_Y + siblings * NODE_STEP_Y,
    created_at: now,
    updated_at: now,
  });
  if (inserted.error) fail(inserted.error);
  if (milestones.length > 0) {
    const rows = await client.from("milestones").insert(
      milestones.map((milestone, index) => ({
        id: crypto.randomUUID(),
        tech_id: id,
        name: milestone.name,
        done: milestone.done,
        position: index,
      })),
    );
    if (rows.error) fail(rows.error);
  }
  await bump(client, campaign.id);
  return { ...(await readBoard(campaign.id)), focusId: id };
}

export async function updateNode(campaignId: string, id: string, body: unknown): Promise<BoardSnapshot> {
  const techId = requireId(id);
  const input = parseNodeWrite(body, true);
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  const existing = await techInCampaign(client, campaign.id, techId);
  const eras = await listEraRows(client, campaign.id);
  let eraId = input.eraId ?? existing.era_id ?? eras[0]?.id;
  let x = input.x ?? existing.x;
  let y = input.y ?? existing.y;
  if (input.eraId && input.eraId !== existing.era_id) {
    const era = eras.find((item) => item.id === input.eraId);
    if (!era) throw new BoardRequestError(400, "That era isn't on the board.");
    const techs = await listTechRows(client, campaign.id);
    const siblings = techs.filter((tech) => tech.era_id === era.id && tech.id !== techId).length;
    eraId = era.id;
    x = columnX(Math.max(0, eras.findIndex((item) => item.id === era.id)));
    y = FIRST_NODE_Y + siblings * NODE_STEP_Y;
  } else if (input.x !== undefined) {
    const index = nearestColumnIndex(input.x, eras.length);
    const era = eras[index];
    if (era) {
      eraId = era.id;
      x = columnX(index);
      y = Math.max(FIRST_NODE_Y, Math.round(y));
    }
  }
  const seen = seenUpdatedAt(body);
  let query = client
    .from("techs")
    .update({
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
      updated_at: Date.now(),
    })
    .eq("id", techId)
    .eq("campaign_id", campaign.id);
  if (seen !== null) query = query.eq("updated_at", seen);
  const updated = await query.select("id");
  if (updated.error) fail(updated.error);
  if (!updated.data || updated.data.length === 0) {
    if (seen !== null) throw new BoardRequestError(409, CARD_CONFLICT);
    throw new BoardRequestError(404, "That capability is no longer on the board.");
  }
  await bump(client, campaign.id);
  return readBoard(campaign.id);
}

export async function deleteNode(campaignId: string, id: string): Promise<BoardSnapshot> {
  const techId = requireId(id);
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  const removed = await client.from("techs").delete().eq("id", techId).eq("campaign_id", campaign.id).select("id");
  if (removed.error) fail(removed.error);
  if (!removed.data || removed.data.length === 0) {
    throw new BoardRequestError(404, "That capability is no longer on the board.");
  }
  await bump(client, campaign.id);
  return readBoard(campaign.id);
}

export async function createEdge(campaignId: string, body: unknown): Promise<BoardSnapshot> {
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
  const record = body as Record<string, unknown>;
  const author = requireAuthor(record.author);
  if (typeof record.source !== "string" || typeof record.target !== "string") {
    throw new BoardRequestError(400, "Pick two capabilities to connect.");
  }
  const source = requireId(record.source);
  const target = requireId(record.target);
  if (source === target) throw new BoardRequestError(400, "A capability can't lead to itself.");
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  await techInCampaign(client, campaign.id, source);
  await techInCampaign(client, campaign.id, target);
  const count = await client.from("links").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id);
  if (count.error) fail(count.error);
  if ((count.count ?? 0) >= LIMITS.edges) {
    throw new BoardRequestError(400, "This board has enough links. Remove one before adding another.");
  }
  const duplicate = await client.from("links").select("id").eq("source", source).eq("target", target).maybeSingle();
  if (duplicate.error) fail(duplicate.error);
  if (duplicate.data) throw new BoardRequestError(409, "Those two are already linked that way.");
  const inserted = await client.from("links").insert({
    id: crypto.randomUUID(),
    campaign_id: campaign.id,
    source,
    target,
    author,
    created_at: Date.now(),
  });
  if (inserted.error) {
    if (inserted.error.code === "23505") throw new BoardRequestError(409, "Those two are already linked that way.");
    fail(inserted.error);
  }
  await bump(client, campaign.id);
  return readBoard(campaign.id);
}

export async function deleteEdge(campaignId: string, id: string): Promise<BoardSnapshot> {
  const linkId = requireId(id);
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  const removed = await client.from("links").delete().eq("id", linkId).eq("campaign_id", campaign.id).select("id");
  if (removed.error) fail(removed.error);
  if (!removed.data || removed.data.length === 0) throw new BoardRequestError(404, "That link is already gone.");
  await bump(client, campaign.id);
  return readBoard(campaign.id);
}

async function placeByEra(client: SupabaseClient, campaignId: string): Promise<void> {
  const eras = await listEraRows(client, campaignId);
  const techs = await listTechRows(client, campaignId);
  for (const [column, era] of eras.entries()) {
    const members = techs
      .filter((tech) => tech.era_id === era.id)
      .sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
    for (const [index, tech] of members.entries()) {
      const updated = await client
        .from("techs")
        .update({ era_id: era.id, x: columnX(column), y: FIRST_NODE_Y + index * NODE_STEP_Y })
        .eq("id", tech.id);
      if (updated.error) fail(updated.error);
    }
  }
}

export async function createEra(campaignId: string, body: unknown): Promise<BoardSnapshot> {
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
  const record = body as Record<string, unknown>;
  requireAuthor(record.author);
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  const eras = await listEraRows(client, campaign.id);
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
  const inserted = await client.from("eras").insert({
    id: crypto.randomUUID(),
    campaign_id: campaign.id,
    name,
    position: eras.length,
  });
  if (inserted.error) fail(inserted.error);
  await bump(client, campaign.id);
  return readBoard(campaign.id);
}

export async function updateEra(campaignId: string, id: string, body: unknown): Promise<BoardSnapshot> {
  const eraId = requireId(id);
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
  const record = body as Record<string, unknown>;
  requireAuthor(record.author);
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  const eras = await listEraRows(client, campaign.id);
  const index = eras.findIndex((era) => era.id === eraId);
  if (index < 0) throw new BoardRequestError(404, "That era is no longer on the board.");
  if (typeof record.name === "string") {
    const message = validateEraName(record.name);
    if (message) throw new BoardRequestError(400, message);
    const renamed = await client.from("eras").update({ name: normalizeText(record.name) }).eq("id", eraId);
    if (renamed.error) fail(renamed.error);
  }
  if (record.direction === -1 || record.direction === 1) {
    const next = index + record.direction;
    if (next >= 0 && next < eras.length) {
      const current = eras[index];
      const other = eras[next];
      const swapCurrent = await client.from("eras").update({ position: other.position }).eq("id", current.id);
      if (swapCurrent.error) fail(swapCurrent.error);
      const swapOther = await client.from("eras").update({ position: current.position }).eq("id", other.id);
      if (swapOther.error) fail(swapOther.error);
      await placeByEra(client, campaign.id);
    }
  }
  await bump(client, campaign.id);
  return readBoard(campaign.id);
}

export async function createMilestone(campaignId: string, nodeId: string, body: unknown): Promise<BoardSnapshot> {
  const techId = requireId(nodeId);
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
  const record = body as Record<string, unknown>;
  const author = requireAuthor(record.author);
  if (typeof record.name !== "string") throw new BoardRequestError(400, "Name this milestone.");
  const message = validateMilestoneName(record.name);
  if (message) throw new BoardRequestError(400, message);
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  const tech = await techInCampaign(client, campaign.id, techId);
  const milestones = tech.milestones ?? [];
  if (milestones.length >= LIMITS.milestones) {
    throw new BoardRequestError(400, `A card can hold ${LIMITS.milestones} milestones.`);
  }
  const position = milestones.reduce((max, milestone) => Math.max(max, milestone.position), -1) + 1;
  await claimTech(client, techId, author, seenUpdatedAt(body));
  const inserted = await client.from("milestones").insert({
    id: crypto.randomUUID(),
    tech_id: techId,
    name: normalizeText(record.name),
    done: record.done === true,
    position,
  });
  if (inserted.error) fail(inserted.error);
  await bump(client, campaign.id);
  return readBoard(campaign.id);
}

export async function updateMilestone(
  campaignId: string,
  nodeId: string,
  milestoneId: string,
  body: unknown,
): Promise<BoardSnapshot> {
  const techId = requireId(nodeId);
  const id = requireId(milestoneId);
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
  const record = body as Record<string, unknown>;
  const author = requireAuthor(record.author);
  const hasName = record.name !== undefined;
  const hasDone = record.done !== undefined;
  if (!hasName && !hasDone) throw new BoardRequestError(400, "Nothing on that milestone changed.");
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
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  const tech = await techInCampaign(client, campaign.id, techId);
  const existing = (tech.milestones ?? []).find((milestone) => milestone.id === id);
  if (!existing) throw new BoardRequestError(404, "That milestone is no longer on the card.");
  await claimTech(client, techId, author, seenUpdatedAt(body));
  const updated = await client
    .from("milestones")
    .update({ name: name ?? existing.name, done: hasDone ? record.done === true : existing.done })
    .eq("id", id)
    .eq("tech_id", techId);
  if (updated.error) fail(updated.error);
  await bump(client, campaign.id);
  return readBoard(campaign.id);
}

export async function deleteMilestone(
  campaignId: string,
  nodeId: string,
  milestoneId: string,
  body: unknown,
): Promise<BoardSnapshot> {
  const techId = requireId(nodeId);
  const id = requireId(milestoneId);
  if (!body || typeof body !== "object") throw new BoardRequestError(400, "That request was empty.");
  const author = requireAuthor((body as Record<string, unknown>).author);
  const client = configuredClient();
  const campaign = await campaignRow(client, campaignId);
  await techInCampaign(client, campaign.id, techId);
  await claimTech(client, techId, author, seenUpdatedAt(body));
  const removed = await client.from("milestones").delete().eq("id", id).eq("tech_id", techId).select("id");
  if (removed.error) fail(removed.error);
  if (!removed.data || removed.data.length === 0) {
    throw new BoardRequestError(404, "That milestone is no longer on the card.");
  }
  await bump(client, campaign.id);
  return readBoard(campaign.id);
}

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HELP = `Meridian CLI

Read and edit a campaign in Supabase. Same data as the app.
JSON on stdout. Pass flags, or a JSON object on stdin. Flags win.
Exit 0 on success and on --help. Exit 1 when the request fails. Exit 2 on bad usage.

Usage
  meridian --help
  meridian campaigns list
  meridian campaigns create --name <name> [--author <name>]
  meridian campaigns export --campaign <id> --out <file.html>
  meridian tree dump --campaign <id>
  meridian techs create --campaign <id> --title <title> [--description <text>] [--detail <text>] [--glyph <glyph>] [--proficiency good|bad|neutral] [--commitment doing|not_doing|next] [--era <id-or-name>] [--author <name>]
  meridian techs update --campaign <id> --id <tech-id> [--title <title>] [--description <text>] [--detail <text>] [--glyph <glyph>] [--proficiency good|bad|neutral] [--commitment doing|not_doing|next] [--era <id-or-name>] [--author <name>]
  meridian techs delete --campaign <id> --id <tech-id>
  meridian techs move --campaign <id> --id <tech-id> --era <id-or-name> [--author <name>]
  meridian milestones add --campaign <id> --tech <tech-id> --name <name> [--done true|false] [--author <name>]
  meridian milestones set --campaign <id> --tech <tech-id> --id <milestone-id> --done true|false [--name <name>] [--author <name>]
  meridian links add --campaign <id> --from <tech-id> --to <tech-id> [--author <name>]
  meridian links remove --campaign <id> (--id <link-id> | --from <tech-id> --to <tech-id>)
  meridian eras rename --campaign <id> (--id <era-id> | --era <id-or-name>) --name <name> [--author <name>]

Defaults
  --author is "Meridian CLI" when omitted.
  techs create uses proficiency neutral and commitment next when omitted.
  milestones add uses --done false when omitted.

Export
  campaigns export writes one HTML file for that campaign. Open the file in a browser.
  It embeds the eras, techs, milestones, and links. It has no server and no secrets.
  Edits stay in the file. Download updated file saves a new copy. It does not sync back.

Environment
  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment or .env.local.
  The service role key stays in this process. It is never printed.

JSON
  A dumped tree is { campaign, revision, eras, techs, links }.
  Milestones are nested on each tech. Links use source and target tech ids.
  Glyphs: compass, quill, lantern, lens, sprout, beacon, keystone, anchor.
  techs create accepts a milestones array on stdin: [{ "name", "done" }].
`;

const COMMANDS = {
  "campaigns list": [],
  "campaigns create": ["name", "author"],
  "campaigns export": ["campaign", "out"],
  "tree dump": ["campaign"],
  "techs create": [
    "campaign",
    "title",
    "description",
    "detail",
    "glyph",
    "proficiency",
    "commitment",
    "era",
    "author",
  ],
  "techs update": [
    "campaign",
    "id",
    "title",
    "description",
    "detail",
    "glyph",
    "proficiency",
    "commitment",
    "era",
    "author",
  ],
  "techs delete": ["campaign", "id"],
  "techs move": ["campaign", "id", "era", "author"],
  "milestones add": ["campaign", "tech", "name", "done", "author"],
  "milestones set": ["campaign", "tech", "id", "done", "name", "author"],
  "links add": ["campaign", "from", "to", "author"],
  "links remove": ["campaign", "id", "from", "to"],
  "eras rename": ["campaign", "id", "era", "name", "author"],
};

if (process.env.MERIDIAN_CLI_READY !== "1") {
  const script = fileURLToPath(import.meta.url);
  const register = fileURLToPath(new URL("./register.mjs", import.meta.url));
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--import",
      register,
      script,
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", env: { ...process.env, MERIDIAN_CLI_READY: "1" } },
  );
  process.exit(result.status === null ? 1 : result.status);
}

const envFromFile = new Set();

loadEnv(fileURLToPath(new URL("../.env", import.meta.url)));
loadEnv(fileURLToPath(new URL("../.env.local", import.meta.url)));

const { positionals, flags } = parseArgs(process.argv.slice(2));
const command = positionals.slice(0, 2).join(" ");

if (flags.help || positionals[0] === "help") {
  process.stdout.write(HELP);
  process.exit(0);
}

if (!command) {
  process.stdout.write(HELP);
  process.exit(2);
}

const stdin = await readStdin();

const allowed = COMMANDS[command];
if (!allowed) {
  finish(false, `Unknown command "${command}". Run meridian --help.`, 2);
}

const unknown = Object.keys(flags).filter((flag) => flag !== "help" && !allowed.includes(flag));
if (unknown.length > 0) {
  finish(false, `Unknown flag --${unknown[0]}. Run meridian --help.`, 2);
}

try {
  const db = await import("../src/lib/db.ts");
  await dispatch(db, command, flags, stdin);
} catch (error) {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  const code = status === 400 ? 2 : 1;
  const message = error instanceof Error ? error.message : "The request failed.";
  finish(false, message, code);
}

function loadEnv(file) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined && !envFromFile.has(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
    envFromFile.add(key);
  }
}

function parseArgs(argv) {
  const positionals = [];
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq >= 0) {
      parsed[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      parsed[body] = true;
      continue;
    }
    parsed[body] = next;
    index += 1;
  }
  return { positionals, flags: parsed };
}

async function readStdin() {
  if (process.stdin.isTTY) return {};
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    finish(false, "JSON on stdin must be an object.", 2);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    finish(false, "JSON on stdin must be an object.", 2);
  }
  return value;
}

function finish(ok, error, code) {
  process.stdout.write(`${JSON.stringify({ ok, error }, null, 2)}\n`);
  process.exit(code);
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify({ ok: true, ...payload }, null, 2)}\n`);
  process.exit(0);
}

function pick(flags, json, ...keys) {
  for (const key of keys) {
    if (flags[key] !== undefined && flags[key] !== true) return flags[key];
  }
  for (const key of keys) {
    if (json[key] !== undefined) return json[key];
  }
  return undefined;
}

function requiredString(flags, json, label, ...keys) {
  const value = pick(flags, json, ...keys);
  if (typeof value !== "string" || value.trim() === "") {
    finish(false, `Pass --${label}.`, 2);
  }
  return value;
}

function authorOf(flags, json) {
  const value = pick(flags, json, "author");
  return typeof value === "string" && value.trim() ? value : "Meridian CLI";
}

function campaignOf(flags, json) {
  return requiredString(flags, json, "campaign <id>", "campaign", "campaignId");
}

function parseDone(value, fallback) {
  if (value === undefined) return fallback;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  finish(false, "Pass --done true or --done false.", 2);
}

function treeOf(board) {
  return {
    campaign: board.campaign ?? null,
    revision: board.revision,
    eras: board.eras,
    techs: board.nodes,
    links: board.edges,
  };
}

function findEra(eras, token) {
  const byId = eras.find((era) => era.id === token);
  if (byId) return byId;
  const named = eras.filter((era) => era.name.toLowerCase() === String(token).toLowerCase());
  if (named.length === 1) return named[0];
  if (named.length > 1) {
    finish(false, `More than one era is named "${token}". Pass the era id.`, 2);
  }
  return null;
}

async function eraIdOf(db, campaign, flags, json) {
  const token = pick(flags, json, "era", "eraId");
  if (typeof token !== "string" || token.trim() === "") return undefined;
  const board = await db.readBoard(campaign);
  const era = findEra(board.eras, token);
  if (!era) finish(false, `No era named "${token}" is on that campaign.`, 2);
  return era.id;
}

function techOn(board, id) {
  return board.nodes.find((node) => node.id === id) ?? null;
}

async function dispatch(db, command, flags, json) {
  if (command === "campaigns list") {
    emit({ campaigns: await db.listCampaigns() });
  }

  if (command === "campaigns create") {
    const name = requiredString(flags, json, "name <name>", "name");
    const campaign = await db.createCampaign({ name, author: authorOf(flags, json) });
    emit({ campaign });
  }

  if (command === "campaigns export") {
    const campaign = campaignOf(flags, json);
    const out = requiredString(flags, json, "out <file.html>", "out");
    const html = await import("../src/lib/portable-html.ts");
    const portable = html.toPortableCampaign(await db.readBoard(campaign));
    try {
      writeFileSync(out, html.renderPortableHtml(portable));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't write that file.";
      finish(false, message, 1);
    }
    emit({ out, campaign: { id: portable.id, name: portable.name } });
  }

  if (command === "tree dump") {
    emit(treeOf(await db.readBoard(campaignOf(flags, json))));
  }

  if (command === "techs create") {
    const campaign = campaignOf(flags, json);
    const title = requiredString(flags, json, "title <title>", "title");
    const eraId = await eraIdOf(db, campaign, flags, json);
    const body = {
      author: authorOf(flags, json),
      title,
      description: typeof pick(flags, json, "description") === "string" ? pick(flags, json, "description") : "",
      detail: typeof pick(flags, json, "detail") === "string" ? pick(flags, json, "detail") : "",
      proficiency: pick(flags, json, "proficiency") ?? "neutral",
      commitment: pick(flags, json, "commitment") ?? "next",
    };
    const glyph = pick(flags, json, "glyph");
    if (typeof glyph === "string") body.glyph = glyph;
    if (eraId) body.eraId = eraId;
    if (Array.isArray(json.milestones)) body.milestones = json.milestones;
    const board = await db.createNode(campaign, body);
    const tech = techOn(board, board.focusId);
    emit({ tech });
  }

  if (command === "techs update") {
    const campaign = campaignOf(flags, json);
    const id = requiredString(flags, json, "id <tech-id>", "id", "tech");
    const body = { author: authorOf(flags, json) };
    for (const key of ["title", "description", "detail", "glyph", "proficiency", "commitment"]) {
      const value = pick(flags, json, key);
      if (typeof value === "string") body[key] = value;
    }
    const eraId = await eraIdOf(db, campaign, flags, json);
    if (eraId) body.eraId = eraId;
    const board = await db.updateNode(campaign, id, body);
    emit({ tech: techOn(board, id) });
  }

  if (command === "techs delete") {
    const campaign = campaignOf(flags, json);
    const id = requiredString(flags, json, "id <tech-id>", "id", "tech");
    await db.deleteNode(campaign, id);
    emit({ deleted: id });
  }

  if (command === "techs move") {
    const campaign = campaignOf(flags, json);
    const id = requiredString(flags, json, "id <tech-id>", "id", "tech");
    const eraId = await eraIdOf(db, campaign, flags, json);
    if (!eraId) finish(false, "Pass --era <id-or-name>.", 2);
    const board = await db.updateNode(campaign, id, { author: authorOf(flags, json), eraId });
    emit({ tech: techOn(board, id) });
  }

  if (command === "milestones add") {
    const campaign = campaignOf(flags, json);
    const techId = requiredString(flags, json, "tech <tech-id>", "tech", "techId");
    const name = requiredString(flags, json, "name <name>", "name");
    const done = parseDone(pick(flags, json, "done"), false);
    const board = await db.createMilestone(campaign, techId, {
      author: authorOf(flags, json),
      name,
      done,
    });
    const tech = techOn(board, techId);
    const milestone = [...(tech?.milestones ?? [])].sort((a, b) => b.position - a.position)[0] ?? null;
    emit({ milestone, tech });
  }

  if (command === "milestones set") {
    const campaign = campaignOf(flags, json);
    const techId = requiredString(flags, json, "tech <tech-id>", "tech", "techId");
    const id = requiredString(flags, json, "id <milestone-id>", "id", "milestone");
    const done = parseDone(pick(flags, json, "done"), undefined);
    if (done === undefined) finish(false, "Pass --done true or --done false.", 2);
    const body = { author: authorOf(flags, json), done };
    const name = pick(flags, json, "name");
    if (typeof name === "string") body.name = name;
    const board = await db.updateMilestone(campaign, techId, id, body);
    const tech = techOn(board, techId);
    emit({ milestone: tech?.milestones.find((item) => item.id === id) ?? null, tech });
  }

  if (command === "links add") {
    const campaign = campaignOf(flags, json);
    const source = requiredString(flags, json, "from <tech-id>", "from", "source");
    const target = requiredString(flags, json, "to <tech-id>", "to", "target");
    const board = await db.createEdge(campaign, {
      author: authorOf(flags, json),
      source,
      target,
    });
    const link = board.edges.find((edge) => edge.source === source && edge.target === target) ?? null;
    emit({ link });
  }

  if (command === "links remove") {
    const campaign = campaignOf(flags, json);
    let id = pick(flags, json, "id", "link");
    if (typeof id !== "string" || !id) {
      const source = requiredString(flags, json, "from <tech-id>", "from", "source");
      const target = requiredString(flags, json, "to <tech-id>", "to", "target");
      const board = await db.readBoard(campaign);
      const link = board.edges.find((edge) => edge.source === source && edge.target === target);
      if (!link) finish(false, "That link is already gone.", 1);
      id = link.id;
    }
    await db.deleteEdge(campaign, id);
    emit({ deleted: id });
  }

  if (command === "eras rename") {
    const campaign = campaignOf(flags, json);
    const name = requiredString(flags, json, "name <name>", "name");
    let id = pick(flags, json, "id");
    const eraToken = pick(flags, json, "era", "eraId");
    if (typeof id !== "string" || !id) {
      if (typeof eraToken !== "string" || !eraToken) finish(false, "Pass --id <era-id> or --era <id-or-name>.", 2);
      const board = await db.readBoard(campaign);
      const era = findEra(board.eras, eraToken);
      if (!era) finish(false, `No era named "${eraToken}" is on that campaign.`, 2);
      id = era.id;
    }
    const board = await db.updateEra(campaign, id, { author: authorOf(flags, json), name });
    emit({ era: board.eras.find((era) => era.id === id) ?? null });
  }
}

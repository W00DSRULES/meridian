import type { BoardSnapshot } from "@/lib/types";

export type PortableMilestone = {
  id: string;
  name: string;
  done: boolean;
  position: number;
};

export type PortableTech = {
  id: string;
  title: string;
  description: string;
  detail: string;
  glyph: string;
  proficiency: "good" | "bad" | "neutral";
  eraId: string;
  x: number;
  y: number;
  milestones: PortableMilestone[];
};

export type PortableEra = {
  id: string;
  name: string;
  position: number;
};

export type PortableLink = {
  id: string;
  source: string;
  target: string;
};

export type PortableCampaign = {
  id: string;
  name: string;
  eras: PortableEra[];
  techs: PortableTech[];
  links: PortableLink[];
};

const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  background: #07111c;
  color: #f4efe6;
  font-family: "Segoe UI", system-ui, sans-serif;
}
button, input, textarea { font: inherit; color: inherit; }
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(224, 192, 136, 0.25);
  background: rgba(7, 20, 34, 0.94);
}
.brand {
  margin: 0;
  font-family: Georgia, "Palatino Linotype", serif;
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #e0c088;
}
h1 {
  margin: 2px 0 6px;
  font-family: Georgia, "Palatino Linotype", serif;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.banner {
  max-width: 46rem;
  margin: 0;
  color: #c5d0de;
  font-size: 14px;
  line-height: 1.45;
}
.download {
  border: 1px solid rgba(224, 192, 136, 0.55);
  border-radius: 8px;
  background: #14304c;
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 650;
}
.download:hover { background: #1b4064; }
.progress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px 12px;
  color: #d5deea;
  font-size: 13px;
}
.track {
  flex: 1;
  max-width: 280px;
  height: 8px;
  border-radius: 999px;
  background: #101820;
  overflow: hidden;
}
.track span { display: block; height: 100%; }
.scroll { overflow: auto; padding: 8px 12px 48px; }
.stage { position: relative; }
.links { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
.plaque {
  position: absolute;
  display: flex;
  height: 40px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(231, 201, 138, 0.72);
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(48, 78, 118, 0.98), rgba(14, 26, 46, 0.98));
  box-shadow: inset 0 0 0 1px rgba(8, 14, 24, 0.85);
}
.numeral {
  color: rgba(231, 201, 138, 0.9);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.22em;
}
.era-name {
  font-family: Georgia, "Palatino Linotype", serif;
  font-size: 18px;
  font-weight: 600;
}
.bar {
  position: absolute;
  display: flex;
  height: 44px;
  align-items: center;
  gap: 8px;
  width: 308px;
  border: 1px solid var(--frame);
  border-radius: 8px;
  background: linear-gradient(90deg, var(--wash), #0c1016 78%);
  box-shadow: inset 0 0 14px var(--wash), 0 0 12px var(--glow);
  padding: 0 8px 0 5px;
  text-align: left;
  cursor: pointer;
}
.bar[data-open="true"] {
  box-shadow: 0 0 0 1px var(--ink), inset 0 0 18px var(--wash), 0 0 22px var(--glow);
}
.medallion {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border: 1px solid var(--frame);
  border-radius: 999px;
  background: radial-gradient(circle at 40% 35%, #1a222c, #0b0e12 70%);
  color: var(--ink);
}
.medallion svg { width: 15px; height: 15px; }
.title {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;
  font-family: Georgia, "Palatino Linotype", serif;
  font-size: 14px;
}
.title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mark { flex: none; font-family: "Segoe UI Emoji", "Apple Color Emoji", sans-serif; }
.pips { display: flex; gap: 3px; margin: 0; padding: 0; list-style: none; }
.pips li {
  width: 8px;
  height: 8px;
  border: 1px solid rgba(214, 226, 238, 0.45);
  border-radius: 999px;
}
.pips li[data-done="true"] {
  border-color: var(--frame);
  background: var(--frame);
  box-shadow: 0 0 6px var(--glow);
}
.fraction {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.shade {
  position: fixed;
  inset: 0;
  background: rgba(4, 8, 14, 0.55);
}
.panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  width: min(440px, 100%);
  overflow: auto;
  border-left: 1px solid rgba(231, 201, 138, 0.45);
  background: #0c1828;
  box-shadow: -24px 0 60px rgba(0, 0, 0, 0.45);
  padding: 18px 18px 32px;
}
.panel h2 {
  margin: 0 0 12px;
  font-family: Georgia, "Palatino Linotype", serif;
  font-size: 22px;
}
.panel label, .panel legend {
  display: block;
  margin: 12px 0 6px;
  color: #e0c088;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.panel input[type="text"], .panel textarea {
  width: 100%;
  border: 1px solid rgba(224, 192, 136, 0.28);
  border-radius: 6px;
  background: #0b1626;
  padding: 8px 10px;
}
.panel textarea { min-height: 120px; resize: vertical; }
.emoji-row { display: flex; gap: 8px; }
.emoji-option {
  display: flex;
  width: 7rem;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 6px 4px;
  cursor: pointer;
}
.emoji-option[data-selected="true"] {
  border-color: rgba(231, 201, 138, 0.7);
  background: rgba(231, 201, 138, 0.08);
}
.emoji { font-size: 22px; line-height: 1; }
.caption { font-size: 13px; font-weight: 650; }
.milestone {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
}
.milestone input[type="text"] { flex: 1; }
.ghost, .add {
  border: 1px solid rgba(224, 192, 136, 0.35);
  border-radius: 6px;
  background: transparent;
  padding: 7px 10px;
  cursor: pointer;
}
.add-row { display: flex; gap: 8px; margin-top: 8px; }
.add-row input { flex: 1; }
.links-read { margin: 0; padding-left: 18px; color: #d5deea; }
.hint { color: #9aa6b2; font-size: 13px; }
.close {
  float: right;
  border: 0;
  background: transparent;
  color: #e0c088;
  cursor: pointer;
}
.form-error { color: #f0b0a0; font-size: 13px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.add-tech {
  position: absolute;
  width: 308px;
  height: 40px;
  border: 1px dashed rgba(231, 201, 138, 0.8);
  border-radius: 8px;
  background: rgba(16, 36, 58, 0.92);
  color: #f3e2b3;
  font-weight: 650;
  cursor: pointer;
}
.era-pick {
  display: block;
  width: 100%;
  margin-top: 8px;
  text-align: left;
}
noscript p {
  margin: 16px 20px;
  color: #f4efe6;
}
`;

const RUNTIME = `
var STYLE = document.getElementById("meridian-style").textContent;
var RUNTIME = document.getElementById("meridian-runtime").textContent;
var state = JSON.parse(document.getElementById("meridian-data").textContent);
var selectedId = null;
var COL_W = 308;
var GAP = 48;
var STOPS = [
  { t: 0, frame: [42, 46, 54], wash: [12, 14, 18] },
  { t: 0.2, frame: [64, 104, 148], wash: [28, 52, 82] },
  { t: 0.5, frame: [142, 198, 236], wash: [48, 96, 140] },
  { t: 0.82, frame: [86, 196, 164], wash: [28, 92, 74] },
  { t: 1, frame: [54, 196, 108], wash: [24, 110, 62] }
];
var MARK = { good: "\\u{1F525}", bad: "\\u{1FAE0}", neutral: "\\u{1F937}" };
var CAPTION = { good: "Good at this", bad: "Weak here", neutral: "Neutral" };
var GLYPH = {
  compass: '<circle cx="16" cy="16" r="10"/><path d="M16 6.5v2.2M16 23.3V25.5M6.5 16h2.2M23.3 16H25.5"/><path d="m18.8 13.2-6.2 2.2 2.2 6.2 6.2-2.2z"/>',
  quill: '<path d="M9 23c6-1 12-8 14-16-6 2-12 7-14 16z"/><path d="M12.5 19.5c2.2-2.4 5-5 8-7"/><path d="M9 23c1.2 1.4 2.4 2.2 4.2 2.6"/>',
  lantern: '<path d="M13 8h6M16 8V6"/><rect x="11" y="10" width="10" height="12" rx="1.5"/><path d="M16 14v4M11 22h10"/>',
  lens: '<circle cx="14" cy="14" r="6.5"/><path d="m19 19 6 6"/><path d="M11.5 14h5M14 11.5v5"/>',
  sprout: '<path d="M16 26V14"/><path d="M16 18c-4-1-7-5-7-9 5 0 8 3 8 9z"/><path d="M16 16c4-1 7-4 8-8-5 .2-8 3-8 8z"/>',
  beacon: '<path d="M16 26V12"/><path d="M12 26h8"/><path d="M16 12c3 0 5-2.2 5-5H11c0 2.8 2 5 5 5z"/><path d="M8 14c2 1.4 4.2 2 8 2s6-.6 8-2"/>',
  keystone: '<path d="M8 24V14l8-6 8 6v10"/><path d="M13 24v-6h6v6"/>',
  anchor: '<circle cx="16" cy="12" r="3.2"/><path d="M16 15.2V22"/><path d="M10 22h12"/><path d="M12 25h8"/>'
};
var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function columnLeft(index) { return 8 + index * (COL_W + GAP); }
function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fileName(name) {
  var slug = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return (slug || "campaign") + ".html";
}
function counts(tech) {
  var done = 0;
  var list = tech.milestones || [];
  for (var i = 0; i < list.length; i += 1) if (list[i].done) done += 1;
  return { done: done, total: list.length };
}
function mix(a, b, t) { return a + (b - a) * t; }
function rgb(channels, alpha) {
  var body = Math.round(channels[0]) + " " + Math.round(channels[1]) + " " + Math.round(channels[2]);
  if (alpha === undefined) return "rgb(" + body + ")";
  return "rgb(" + body + " / " + alpha + ")";
}
function paint(done, total) {
  var fraction = total <= 0 || done <= 0 ? 0 : Math.min(1, done / total);
  var start = STOPS[0];
  var end = STOPS[STOPS.length - 1];
  for (var i = 0; i < STOPS.length - 1; i += 1) {
    if (fraction >= STOPS[i].t && fraction <= STOPS[i + 1].t) {
      start = STOPS[i];
      end = STOPS[i + 1];
      break;
    }
  }
  var span = end.t - start.t || 1;
  var local = (fraction - start.t) / span;
  var frame = [mix(start.frame[0], end.frame[0], local), mix(start.frame[1], end.frame[1], local), mix(start.frame[2], end.frame[2], local)];
  var wash = [mix(start.wash[0], end.wash[0], local), mix(start.wash[1], end.wash[1], local), mix(start.wash[2], end.wash[2], local)];
  var ink = fraction === 0 ? [168, 176, 188] : [mix(frame[0], 244, 0.42), mix(frame[1], 250, 0.42), mix(frame[2], 255, 0.42)];
  return {
    frame: rgb(frame),
    wash: rgb(wash),
    glow: fraction === 0 ? "transparent" : rgb(frame, 0.2 + fraction * 0.5),
    ink: rgb(ink),
    fraction: fraction
  };
}
function sortedEras() {
  return state.eras.slice().sort(function (a, b) { return a.position - b.position; });
}
function sortedMilestones(tech) {
  return tech.milestones.slice().sort(function (a, b) { return a.position - b.position; });
}
function techById(id) {
  for (var i = 0; i < state.techs.length; i += 1) if (state.techs[i].id === id) return state.techs[i];
  return null;
}
function glyphSvg(name) {
  var body = GLYPH[name] || GLYPH.anchor;
  return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
}
function applyPaint(node, tech) {
  var tally = counts(tech);
  var color = paint(tally.done, tally.total);
  node.style.setProperty("--frame", color.frame);
  node.style.setProperty("--wash", color.wash);
  node.style.setProperty("--glow", color.glow);
  node.style.setProperty("--ink", color.ink);
  var pips = node.querySelector(".pips");
  pips.replaceChildren();
  sortedMilestones(tech).forEach(function (milestone) {
    var pip = document.createElement("li");
    pip.dataset.done = milestone.done ? "true" : "false";
    pips.append(pip);
  });
  node.querySelector(".fraction").textContent = tally.done + "/" + tally.total;
  node.querySelector(".title-text").textContent = tech.title || "Untitled";
  node.querySelector(".mark").textContent = MARK[tech.proficiency] || MARK.neutral;
}
function campaignTally() {
  var done = 0;
  var total = 0;
  state.techs.forEach(function (tech) {
    var tally = counts(tech);
    done += tally.done;
    total += tally.total;
  });
  return { done: done, total: total };
}
function renderProgress() {
  var tally = campaignTally();
  var color = paint(tally.done, tally.total);
  var host = document.getElementById("progress");
  host.replaceChildren();
  var label = document.createElement("span");
  label.textContent = "Progress";
  var track = document.createElement("span");
  track.className = "track";
  var fill = document.createElement("span");
  var width = tally.total === 0 ? 0 : Math.round((tally.done / tally.total) * 100);
  fill.style.width = width + "%";
  fill.style.background = color.frame;
  track.append(fill);
  var count = document.createElement("span");
  count.textContent = tally.done + " of " + tally.total + " milestones";
  host.append(label, track, count);
}
function renderBoard() {
  var stage = document.getElementById("stage");
  stage.replaceChildren();
  var eras = sortedEras();
  var width = 32;
  var height = 140;
  eras.forEach(function (_, index) { width = Math.max(width, columnLeft(index) + COL_W + 24); });
  state.techs.forEach(function (tech) {
    width = Math.max(width, tech.x + COL_W + 24);
    height = Math.max(height, tech.y + 72);
  });
  eras.forEach(function (era) {
    height = Math.max(height, nextSlotY(era.id) + 64);
  });
  stage.style.width = width + "px";
  stage.style.height = height + "px";
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "links");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = '<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8d7350"></path></marker>';
  svg.append(defs);
  var byId = {};
  state.techs.forEach(function (tech) { byId[tech.id] = tech; });
  state.links.forEach(function (link) {
    var from = byId[link.source];
    var to = byId[link.target];
    if (!from || !to) return;
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    var x1 = from.x + COL_W;
    var y1 = from.y + 22;
    var x2 = to.x;
    var y2 = to.y + 22;
    var mid = Math.round((x1 + x2) / 2);
    path.setAttribute("d", "M " + x1 + " " + y1 + " H " + mid + " V " + y2 + " H " + x2);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#8d7350");
    path.setAttribute("stroke-width", "1.75");
    path.setAttribute("marker-end", "url(#arrow)");
    svg.append(path);
  });
  stage.append(svg);
  eras.forEach(function (era, index) {
    var plaque = document.createElement("div");
    plaque.className = "plaque";
    plaque.style.left = columnLeft(index) + "px";
    plaque.style.top = "8px";
    plaque.style.width = COL_W + "px";
    plaque.dataset.testid = "portable-era";
    var numeral = document.createElement("span");
    numeral.className = "numeral";
    numeral.textContent = ROMAN[index] || String(index + 1);
    var name = document.createElement("span");
    name.className = "era-name";
    name.textContent = era.name;
    plaque.append(numeral, name);
    stage.append(plaque);
  });
  state.techs.forEach(function (tech) {
    var bar = document.createElement("button");
    bar.type = "button";
    bar.className = "bar";
    bar.dataset.testid = "portable-bar";
    bar.dataset.id = tech.id;
    bar.dataset.open = tech.id === selectedId ? "true" : "false";
    bar.style.left = tech.x + "px";
    bar.style.top = tech.y + "px";
    bar.innerHTML = '<span class="medallion"></span><span class="title"><span class="title-text"></span><span class="mark"></span></span><ul class="pips"></ul><span class="fraction"></span>';
    bar.querySelector(".medallion").innerHTML = glyphSvg(tech.glyph);
    applyPaint(bar, tech);
    bar.addEventListener("click", function () {
      selectedId = tech.id;
      renderBoard();
      renderPanel();
    });
    stage.append(bar);
  });
  eras.forEach(function (era, index) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "add-tech";
    button.dataset.testid = "portable-add-technology";
    button.dataset.era = era.name;
    button.textContent = "Add technology";
    button.style.left = columnLeft(index) + "px";
    button.style.top = nextSlotY(era.id) + "px";
    button.addEventListener("click", function () { addTech(era.id); });
    stage.append(button);
  });
}
function nextSlotY(eraId) {
  var y = 56;
  var found = false;
  state.techs.forEach(function (tech) {
    if (tech.eraId !== eraId) return;
    found = true;
    y = Math.max(y, tech.y + 56);
  });
  return found ? y : 56;
}
function addTech(eraId) {
  var eras = sortedEras();
  var index = 0;
  for (var i = 0; i < eras.length; i += 1) if (eras[i].id === eraId) index = i;
  var names = ["compass", "quill", "lantern", "lens", "sprout", "beacon", "keystone", "anchor"];
  state.techs.push({
    id: freshId(),
    title: "New technology",
    description: "",
    detail: "",
    glyph: names[state.techs.length % names.length],
    proficiency: "neutral",
    eraId: eraId,
    x: columnLeft(index),
    y: nextSlotY(eraId),
    milestones: []
  });
  selectedId = state.techs[state.techs.length - 1].id;
  renderShell();
}
function askEra() {
  selectedId = null;
  renderBoard();
  var host = document.getElementById("panel");
  host.hidden = false;
  host.replaceChildren();
  var shade = document.createElement("div");
  shade.className = "shade";
  shade.addEventListener("click", function () {
    host.hidden = true;
    host.replaceChildren();
  });
  var panel = document.createElement("aside");
  panel.className = "panel";
  panel.dataset.testid = "portable-which-era";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Which era?");
  var heading = document.createElement("h2");
  heading.textContent = "Which era?";
  var note = document.createElement("p");
  note.className = "hint";
  note.textContent = "The new technology is added to the column you pick. Then edit it here.";
  panel.append(heading, note);
  sortedEras().forEach(function (era) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "add era-pick";
    button.dataset.testid = "portable-era-pick";
    button.textContent = era.name;
    button.addEventListener("click", function () { addTech(era.id); });
    panel.append(button);
  });
  host.append(shade, panel);
}
function field(labelText, control) {
  var label = document.createElement("label");
  label.textContent = labelText;
  var wrap = document.createElement("div");
  wrap.append(label, control);
  return wrap;
}
function renderPanel() {
  var host = document.getElementById("panel");
  var tech = selectedId ? techById(selectedId) : null;
  host.replaceChildren();
  if (!tech) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  var shade = document.createElement("div");
  shade.className = "shade";
  shade.addEventListener("click", closePanel);
  var panel = document.createElement("aside");
  panel.className = "panel";
  panel.dataset.testid = "portable-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", tech.title || "Capability");
  var close = document.createElement("button");
  close.type = "button";
  close.className = "close";
  close.textContent = "Close";
  close.addEventListener("click", closePanel);
  var heading = document.createElement("h2");
  heading.textContent = "Writeup";
  var error = document.createElement("p");
  error.className = "form-error";
  error.dataset.testid = "portable-error";
  var title = document.createElement("input");
  title.type = "text";
  title.maxLength = 80;
  title.value = tech.title;
  title.setAttribute("aria-label", "Title");
  title.dataset.testid = "portable-title";
  title.addEventListener("input", function () {
    tech.title = title.value;
    var bar = document.querySelector('.bar[data-id="' + tech.id + '"]');
    if (bar) bar.querySelector(".title-text").textContent = tech.title || "Untitled";
  });
  var subtitle = document.createElement("input");
  subtitle.type = "text";
  subtitle.maxLength = 280;
  subtitle.value = tech.description;
  subtitle.setAttribute("aria-label", "Subtitle");
  subtitle.addEventListener("input", function () { tech.description = subtitle.value; });
  var detail = document.createElement("textarea");
  detail.maxLength = 900;
  detail.value = tech.detail;
  detail.setAttribute("aria-label", "Description");
  detail.addEventListener("input", function () { tech.detail = detail.value; });
  var emojiRow = document.createElement("div");
  emojiRow.className = "emoji-row";
  emojiRow.setAttribute("role", "group");
  emojiRow.setAttribute("aria-label", "Proficiency");
  ["good", "bad", "neutral"].forEach(function (value) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-option";
    button.dataset.selected = tech.proficiency === value ? "true" : "false";
    button.setAttribute("aria-pressed", tech.proficiency === value ? "true" : "false");
    var face = document.createElement("span");
    face.className = "emoji";
    face.textContent = MARK[value];
    var caption = document.createElement("span");
    caption.className = "caption";
    caption.textContent = CAPTION[value];
    button.append(face, caption);
    button.addEventListener("click", function () {
      tech.proficiency = value;
      var bar = document.querySelector('.bar[data-id="' + tech.id + '"]');
      if (bar) bar.querySelector(".mark").textContent = MARK[value];
      renderPanel();
    });
    emojiRow.append(button);
  });
  var list = document.createElement("div");
  list.dataset.testid = "portable-milestones";
  function showError(message) { error.textContent = message || ""; }
  function redrawList() {
    list.replaceChildren();
    sortedMilestones(tech).forEach(function (milestone) {
      var row = document.createElement("div");
      row.className = "milestone";
      var check = document.createElement("input");
      check.type = "checkbox";
      check.checked = milestone.done;
      check.setAttribute("aria-label", (milestone.done ? "Mark not done: " : "Mark done: ") + milestone.name);
      check.addEventListener("change", function () {
        milestone.done = check.checked;
        var bar = document.querySelector('.bar[data-id="' + tech.id + '"]');
        if (bar) applyPaint(bar, tech);
        renderProgress();
        redrawList();
      });
      var name = document.createElement("input");
      name.type = "text";
      name.maxLength = 80;
      name.value = milestone.name;
      name.setAttribute("aria-label", "Milestone name");
      name.addEventListener("change", function () {
        var next = name.value.replace(/\\s+/g, " ").trim();
        if (!next) {
          showError("Name this milestone.");
          name.value = milestone.name;
          return;
        }
        showError("");
        milestone.name = next;
        name.value = next;
      });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ghost";
      remove.textContent = "Delete";
      remove.addEventListener("click", function () {
        tech.milestones = tech.milestones.filter(function (item) { return item.id !== milestone.id; });
        var bar = document.querySelector('.bar[data-id="' + tech.id + '"]');
        if (bar) applyPaint(bar, tech);
        renderProgress();
        redrawList();
      });
      row.append(check, name, remove);
      list.append(row);
    });
  }
  redrawList();
  var addRow = document.createElement("div");
  addRow.className = "add-row";
  var nextName = document.createElement("input");
  nextName.type = "text";
  nextName.maxLength = 80;
  nextName.placeholder = "Add a milestone";
  nextName.setAttribute("aria-label", "New milestone");
  var add = document.createElement("button");
  add.type = "button";
  add.className = "add";
  add.textContent = "Add";
  function addMilestone() {
    var next = nextName.value.replace(/\\s+/g, " ").trim();
    if (!next) {
      showError("Name this milestone.");
      return;
    }
    if (tech.milestones.length >= 12) {
      showError("A card holds 12 milestones.");
      return;
    }
    showError("");
    var position = tech.milestones.reduce(function (max, item) { return Math.max(max, item.position); }, 0) + 1;
    tech.milestones.push({ id: freshId(), name: next, done: false, position: position });
    nextName.value = "";
    var bar = document.querySelector('.bar[data-id="' + tech.id + '"]');
    if (bar) applyPaint(bar, tech);
    renderProgress();
    redrawList();
  }
  add.addEventListener("click", addMilestone);
  nextName.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addMilestone();
    }
  });
  addRow.append(nextName, add);
  var leads = document.createElement("ul");
  leads.className = "links-read";
  state.links.forEach(function (link) {
    if (link.source !== tech.id) return;
    var target = techById(link.target);
    if (!target) return;
    var item = document.createElement("li");
    item.textContent = target.title;
    leads.append(item);
  });
  if (!leads.childElementCount) {
    var empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "This bar does not lead anywhere yet.";
    leads = empty;
  }
  panel.append(
    close,
    heading,
    error,
    field("Title", title),
    field("Subtitle", subtitle),
    field("Description", detail),
    field("Proficiency", emojiRow),
    field("Milestones", list),
    addRow,
    field("Leads to", leads)
  );
  host.append(shade, panel);
}
function closePanel() {
  selectedId = null;
  renderBoard();
  renderPanel();
}
function freshId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "m-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function pack(data) {
  var json = JSON.stringify(data).replace(/</g, "\\\\u003c");
  return "<!DOCTYPE html>\\n<html lang=\\"en\\"><head><meta charset=\\"utf-8\\"><meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\"><title>" +
    escapeHtml(data.name || "Campaign") + " — Meridian</title><style id=\\"meridian-style\\">" + STYLE +
    "</style></head><body><noscript><p>Turn on JavaScript to open this Meridian copy. It does not contact a server.</p></noscript><script type=\\"application/json\\" id=\\"meridian-data\\">" +
    json + "<" + "/script><div id=\\"app\\"></div><script id=\\"meridian-runtime\\">" + RUNTIME + "<" + "/script></body></html>";
}
function downloadCopy() {
  var html = pack(state);
  var blob = new Blob([html], { type: "text/html" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = fileName(state.name);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function renderShell() {
  var app = document.getElementById("app");
  app.replaceChildren();
  var top = document.createElement("header");
  top.className = "top";
  var copy = document.createElement("div");
  var brand = document.createElement("p");
  brand.className = "brand";
  brand.textContent = "Meridian";
  var heading = document.createElement("h1");
  heading.textContent = state.name || "Campaign";
  heading.dataset.testid = "portable-name";
  var banner = document.createElement("p");
  banner.className = "banner";
  banner.dataset.testid = "portable-banner";
  banner.textContent = "This is a copy of the campaign. Edits stay in this file and do not sync back.";
  copy.append(brand, heading, banner);
  var download = document.createElement("button");
  download.type = "button";
  download.className = "download";
  download.dataset.testid = "download-updated";
  download.textContent = "Download updated file";
  download.addEventListener("click", downloadCopy);
  var addHeader = document.createElement("button");
  addHeader.type = "button";
  addHeader.className = "download";
  addHeader.dataset.testid = "portable-add-header";
  addHeader.textContent = "Add technology";
  addHeader.addEventListener("click", askEra);
  var actions = document.createElement("div");
  actions.className = "actions";
  actions.append(addHeader, download);
  top.append(copy, actions);
  var progress = document.createElement("div");
  progress.id = "progress";
  progress.className = "progress";
  var scroll = document.createElement("div");
  scroll.className = "scroll";
  var stage = document.createElement("div");
  stage.id = "stage";
  stage.className = "stage";
  scroll.append(stage);
  var panel = document.createElement("div");
  panel.id = "panel";
  panel.hidden = true;
  app.append(top, progress, scroll, panel);
  renderProgress();
  renderBoard();
  renderPanel();
}
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && selectedId) closePanel();
});
renderShell();
`;

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function proficiencyOf(value: string): PortableTech["proficiency"] {
  if (value === "good" || value === "bad" || value === "neutral") return value;
  return "neutral";
}

export function portableFileName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "campaign"}.html`;
}

export function toPortableCampaign(board: BoardSnapshot): PortableCampaign {
  return {
    id: board.campaign?.id ?? "",
    name: board.campaign?.name?.trim() || "Campaign",
    eras: board.eras.map((era) => ({ id: era.id, name: era.name, position: era.position })),
    techs: board.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      description: node.description,
      detail: node.detail,
      glyph: node.glyph,
      proficiency: proficiencyOf(node.proficiency),
      eraId: node.eraId,
      x: node.x,
      y: node.y,
      milestones: node.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        done: milestone.done,
        position: milestone.position,
      })),
    })),
    links: board.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
  };
}

export function renderPortableHtml(campaign: PortableCampaign): string {
  const json = embedJson(campaign);
  const title = escapeText(campaign.name || "Campaign");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Meridian</title>
<style id="meridian-style">${STYLE}</style>
</head>
<body>
<noscript><p>Turn on JavaScript to open this Meridian copy. It does not contact a server.</p></noscript>
<script type="application/json" id="meridian-data">${json}</script>
<div id="app"></div>
<script id="meridian-runtime">${RUNTIME}</script>
</body>
</html>
`;
}
